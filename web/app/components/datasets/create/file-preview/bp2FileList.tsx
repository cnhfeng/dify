import React, { useMemo, useState } from 'react'
import { FilmIcon } from '@heroicons/react/24/outline'
import Button from '@/app/components/base/button'
import dayjs from 'dayjs'
import type { FileItem } from '@/models/datasets'

// 定义组件props接口
type BP2FileListProps = {
  onFileListUpdate: (files: FileItem[]) => void; // 添加回调函数prop
}

// 定义文件元数据接口
type FileMetadata = {
  id: string;
  name: string;
  size: number;
  createdBy: string;
  createdAt: string;
}

// 模拟文件数据
const mockFileData: FileMetadata[] = [
  {
    id: '1',
    name: '项目计划书.docx',
    size: 204800,
    createdBy: '张三',
    createdAt: '2023-11-15 09:30:00',
  },
  {
    id: '2',
    name: '数据分析报告.xlsx',
    size: 153600,
    createdBy: '李四',
    createdAt: '2023-11-16 14:20:00',
  },
  {
    id: '3',
    name: '产品原型图.sketch',
    size: 5242880,
    createdBy: '王五',
    createdAt: '2023-11-17 10:15:00',
  },
  {
    id: '4',
    name: '会议记录.pdf',
    size: 819200,
    createdBy: '赵六',
    createdAt: '2023-11-18 16:45:00',
  },
]

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const BP2FileList: React.FC<BP2FileListProps> = (props) => {
  const [files, _] = useState<FileMetadata[]>(mockFileData)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const handleFileSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(fileId => fileId !== id)
        : [...prev, id],
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === files.length)
      setSelectedIds([])
    else
      setSelectedIds(files.map(file => file.id))
  }
  // 检查是否全选
  const isAllSelected = selectedIds.length === files.length && files.length > 0

  const getFileMimeType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sketch: 'application/sketch',
      pdf: 'application/pdf',
      default: 'application/octet-stream',
    }
    return mimeMap[ext || 'default'] || mimeMap.default
  }

  // 处理文件上传
  const handleFileUploadClick = () => {
    // 从模拟数据中筛选出选中的文件
    const selectedFiles = files.filter(file => selectedIds.includes(file.id))

    // 将选中的模拟文件转换为FileItem类型
    const newFiles: FileItem[] = selectedFiles.map(file => ({
      fileID: '123456789123456789123456789',
      // 创建一个模拟的File对象（仅用于展示，实际没有真实文件内容）
      file: new File([], file.name, {
        type: getFileMimeType(file.name),
        lastModified: new Date(file.createdAt).getTime(),
      }),
      progress: 100, // 模拟已完成上传
    }))
    newFiles.forEach((file) => {
      file.file.id = crypto.randomUUID()
    })

    // 通过回调函数将模拟的文件数据传递给父组件
    if (props.onFileListUpdate)
      props.onFileListUpdate(newFiles)
  }

  const nextDisabled = useMemo(() => {
    // selectedIds长度为0 → 未选中任何文件 → 禁用按钮（返回true）
    // selectedIds长度>0 → 选中了文件 → 启用按钮（返回false）
    return selectedIds.length === 0
  }, [selectedIds]) // 仅依赖selectedIds变化，性能更优

  return (
    <div className="space-y-4">
      <Button disabled={nextDisabled} variant='primary' onClick={handleFileUploadClick} className="ml-auto">
        <span className="flex gap-0.5 px-[10px]">
          <span className="px-0.5">上传</span>
        </span>
      </Button>
      {/* 文件列表表格 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  title="全选/取消全选"
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">文件名</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">大小</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">创建者</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {files.map(file => (
              <tr key={file.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(file.id)}
                    onChange={() => handleFileSelect(file.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    title={file.name}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <FilmIcon className="h-5 w-5 text-gray-400" />
                    <div className="ml-3 max-w-xs truncate font-medium text-gray-900">{file.name}</div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{formatFileSize(file.size)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{file.createdBy}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{dayjs(file.createdAt).format('YYYY-MM-DD HH:mm:ss')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BP2FileList
