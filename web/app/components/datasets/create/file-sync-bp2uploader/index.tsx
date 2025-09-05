'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContext } from 'use-context-selector'
import useSWR from 'swr'
import { RiDeleteBinLine } from '@remixicon/react'
import DocumentFileIcon from '../../common/document-file-icon'
import cn from '@/utils/classnames'
import type { CustomFile as File, FileItem } from '@/models/datasets'
import { ToastContext } from '@/app/components/base/toast'
import SimplePieChart from '@/app/components/base/simple-pie-chart'

import { upload } from '@/service/base'
import { fetchFileUploadConfig } from '@/service/common'
import { IS_CE_EDITION } from '@/config'
import { Theme } from '@/types/app'
import useTheme from '@/hooks/use-theme'

const FILES_NUMBER_LIMIT = 20

type SyncBP2IFileUploaderProps = {
  fileList: FileItem[]
  titleClassName?: string
  prepareFileList: (files: FileItem[]) => void
  onFileUpdate: (fileItem: FileItem, progress: number, list: FileItem[]) => void
  onFileListUpdate?: (files: FileItem[]) => void
  onPreview: (file: File) => void
  notSupportBatchUpload?: boolean
}

const SyncBP2Uploader = ({
  fileList,
  titleClassName,
  prepareFileList,
  onFileUpdate,
  onFileListUpdate,
  onPreview,
  notSupportBatchUpload,
}: SyncBP2IFileUploaderProps) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const [_, setDragging] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)
  const fileUploader = useRef<HTMLInputElement>(null)
  const hideUpload = notSupportBatchUpload && fileList.length > 0

  const { data: fileUploadConfigResponse } = useSWR({ url: '/files/upload' }, fetchFileUploadConfig)

  const fileUploadConfig = useMemo(() => fileUploadConfigResponse ?? {
    file_size_limit: 15,
    batch_count_limit: 5,
  }, [fileUploadConfigResponse])
  const fileListRef = useRef<FileItem[]>([])

  // utils
  const getFileType = (currentFile: File) => {
    if (!currentFile)
      return ''

    const arr = currentFile.name.split('.')
    return arr[arr.length - 1]
  }

  const getFileSize = (size: number) => {
    if (size / 1024 < 10)
      return `${(size / 1024).toFixed(2)}KB`

    return `${(size / 1024 / 1024).toFixed(2)}MB`
  }

  const fileUpload = useCallback(async (fileItem: FileItem): Promise<FileItem> => {
    const formData = new FormData()
    formData.append('file', fileItem.file)
    const onProgress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        const percent = Math.floor(e.loaded / e.total * 100)
        onFileUpdate(fileItem, percent, fileListRef.current)
      }
    }

    return upload({
      xhr: new XMLHttpRequest(),
      data: formData,
      onprogress: onProgress,
    }, false, undefined, '?source=datasets')
      .then((res: File) => {
        const completeFile = {
          fileID: fileItem.fileID,
          file: res,
          progress: -1,
        }
        const index = fileListRef.current.findIndex(item => item.fileID === fileItem.fileID)
        fileListRef.current[index] = completeFile
        onFileUpdate(completeFile, 100, fileListRef.current)
        return Promise.resolve({ ...completeFile })
      })
      .catch((e) => {
        notify({ type: 'error', message: e?.response?.code === 'forbidden' ? e?.response?.message : t('datasetCreation.stepOne.uploader.failed') })
        onFileUpdate(fileItem, -2, fileListRef.current)
        return Promise.resolve({ ...fileItem })
      })
      .finally()
  }, [fileListRef, notify, onFileUpdate, t])

  const uploadBatchFiles = useCallback((bFiles: FileItem[]) => {
    bFiles.forEach(bf => (bf.progress = 0))
    return Promise.all(bFiles.map(fileUpload))
  }, [fileUpload])

  const uploadMultipleFiles = useCallback(async (files: FileItem[]) => {
    const batchCountLimit = fileUploadConfig.batch_count_limit
    const length = files.length
    let start = 0
    let end = 0

    while (start < length) {
      if (start + batchCountLimit > length)
        end = length
      else
        end = start + batchCountLimit
      const bFiles = files.slice(start, end)
      await uploadBatchFiles(bFiles)
      start = end
    }
  }, [fileUploadConfig, uploadBatchFiles])

  const initialUpload = useCallback((files: File[]) => {
    if (!files.length)
      return false

    if (files.length + fileList.length > FILES_NUMBER_LIMIT && !IS_CE_EDITION) {
      notify({ type: 'error', message: t('datasetCreation.stepOne.uploader.validation.filesNumber', { filesNumber: FILES_NUMBER_LIMIT }) })
      return false
    }

    const preparedFiles = files.map((file, index) => ({
      fileID: `file${index}-${Date.now()}`,
      file,
      progress: -1,
    }))
    const newFiles = [...fileListRef.current, ...preparedFiles]
    prepareFileList(newFiles)
    fileListRef.current = newFiles
    uploadMultipleFiles(preparedFiles)
  }, [prepareFileList, uploadMultipleFiles, notify, t, fileList])

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.target !== dragRef.current && setDragging(true)
  }
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.target === dragRef.current && setDragging(false)
  }
  type FileWithPath = {
    relativePath?: string
  } & File
  const traverseFileEntry = useCallback(
    (entry: any, prefix = ''): Promise<FileWithPath[]> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file((file: FileWithPath) => {
            file.relativePath = `${prefix}${file.name}`
            resolve([file])
          })
        }
        else if (entry.isDirectory) {
          const reader = entry.createReader()
          const entries: any[] = []
          const read = () => {
            reader.readEntries(async (results: FileSystemEntry[]) => {
              if (!results.length) {
                const files = await Promise.all(
                  entries.map(ent =>
                    traverseFileEntry(ent, `${prefix}${entry.name}/`),
                  ),
                )
                resolve(files.flat())
              }
              else {
                entries.push(...results)
                read()
              }
            })
          }
          read()
        }
        else {
          resolve([])
        }
      })
    },
    [],
  )

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      if (!e.dataTransfer) return
      const nested = await Promise.all(
        Array.from(e.dataTransfer.items).map((it) => {
          const entry = (it as any).webkitGetAsEntry?.()
          if (entry) return traverseFileEntry(entry)
          const f = it.getAsFile?.()
          return f ? Promise.resolve([f]) : Promise.resolve([])
        }),
      )
      let files = nested.flat()
      if (notSupportBatchUpload) files = files.slice(0, 1)
      initialUpload(files)
    },
    [initialUpload, notSupportBatchUpload, traverseFileEntry],
  )

  const removeFile = (fileID: string) => {
    if (fileUploader.current)
      fileUploader.current.value = ''

    fileListRef.current = fileListRef.current.filter(item => item.fileID !== fileID)
    onFileListUpdate?.([...fileListRef.current])
  }
  const fileChangeHandle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])] as File[]
    initialUpload(files)
  }, [initialUpload])

  const { theme } = useTheme()
  const chartColor = useMemo(() => theme === Theme.dark ? '#5289ff' : '#296dff', [theme])

  useEffect(() => {
    dropRef.current?.addEventListener('dragenter', handleDragEnter)
    dropRef.current?.addEventListener('dragover', handleDragOver)
    dropRef.current?.addEventListener('dragleave', handleDragLeave)
    dropRef.current?.addEventListener('drop', handleDrop)
    return () => {
      dropRef.current?.removeEventListener('dragenter', handleDragEnter)
      dropRef.current?.removeEventListener('dragover', handleDragOver)
      dropRef.current?.removeEventListener('dragleave', handleDragLeave)
      dropRef.current?.removeEventListener('drop', handleDrop)
    }
  }, [handleDrop])

  return (
    <div className="mb-5 w-[640px]">
      {!hideUpload && (
        <input
          ref={fileUploader}
          id="fileUploader"
          className="hidden"
          type="file"
          multiple={!notSupportBatchUpload}
          onChange={fileChangeHandle}
          title='-'
        />

      )}

      <div className={cn('mb-1 text-sm font-semibold leading-6 text-text-secondary', titleClassName)}>{t('datasetCreation.stepOne.uploader.title')}</div>
      <div className='max-w-[640px] cursor-default space-y-1'>

        {fileList.map((fileItem, index) => (
          <div
            key={`${fileItem.fileID}-${index}`}
            onClick={() => fileItem.file?.id && onPreview(fileItem.file)}
            className={cn(
              'flex h-12 max-w-[640px] items-center rounded-lg border border-components-panel-border bg-components-panel-on-panel-item-bg text-xs leading-3 text-text-tertiary shadow-xs',
              // 'border-state-destructive-border bg-state-destructive-hover',
            )}
          >
            <div className="flex w-12 shrink-0 items-center justify-center">
              <DocumentFileIcon
                className="size-6 shrink-0"
                name={fileItem.file.name}
                extension={getFileType(fileItem.file)}
              />
            </div>
            <div className="flex shrink grow flex-col gap-0.5">
              <div className='flex w-full'>
                <div className="w-0 grow truncate text-sm leading-4 text-text-secondary">{fileItem.file.name}</div>
              </div>
              <div className="w-full truncate leading-3 text-text-tertiary">
                <span className='uppercase'>{getFileType(fileItem.file)}</span>
                <span className='px-1 text-text-quaternary'>·</span>
                <span>{getFileSize(fileItem.file.size)}</span>
                {/* <span className='px-1 text-text-quaternary'>·</span>
                  <span>10k characters</span> */}
              </div>
            </div>
            <div className="flex w-16 shrink-0 items-center justify-end gap-1 pr-3">
              {/* <span className="flex justify-center items-center w-6 h-6 cursor-pointer">
                  <RiErrorWarningFill className='size-4 text-text-warning' />
                </span> */}
              {(fileItem.progress < 100 && fileItem.progress >= 0) && (
                // <div className={s.percent}>{`${fileItem.progress}%`}</div>
                <SimplePieChart percentage={fileItem.progress} stroke={chartColor} fill={chartColor} animationDuration={0} />
              )}
              <span className="flex h-6 w-6 cursor-pointer items-center justify-center" onClick={(e) => {
                e.stopPropagation()
                removeFile(fileItem.fileID)
              }}>
                <RiDeleteBinLine className='size-4 text-text-tertiary' />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SyncBP2Uploader
