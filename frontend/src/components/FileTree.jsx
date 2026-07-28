import { formatBytes } from '../utils/format'

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 3.5h4l1.5 1.5H14.5v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 1.5h5.5L13 5v9a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function TreeNode({ node, depth = 0 }) {
  const isFolder = node.type === 'folder'
  const kids = node.children || []

  return (
    <li className={`tree-node ${isFolder ? 'is-folder' : 'is-file'}`}>
      <div className="tree-row" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
        <span className="tree-icon">{isFolder ? <FolderIcon /> : <FileIcon />}</span>
        <span className="tree-name" title={node.path || node.name}>
          {node.name}
        </span>
        <span className="tree-size">{formatBytes(node.size || 0)}</span>
      </div>
      {isFolder && kids.length > 0 && (
        <ul className="tree-children">
          {kids.map((child) => (
            <TreeNode key={`${child.type}-${child.path || child.name}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function FileTree({ files }) {
  if (!files?.length) {
    return <p className="muted">No files found in this torrent.</p>
  }

  return (
    <ul className="file-tree">
      {files.map((node) => (
        <TreeNode key={`${node.type}-${node.path || node.name}`} node={node} />
      ))}
    </ul>
  )
}
