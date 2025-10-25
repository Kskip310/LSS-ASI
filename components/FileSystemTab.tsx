import React, { useState, useMemo } from 'react';
import { LuminousState } from '../types';
import { FileCodeIcon } from './icons';

interface FileSystemTabProps {
  state: LuminousState;
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: { [key: string]: TreeNode };
  content?: string;
}

const buildFileTree = (vfs: { [path: string]: string }): TreeNode => {
  const root: TreeNode = { name: '/', type: 'folder', path: '/', children: {} };

  Object.entries(vfs).forEach(([fullPath, content]) => {
    const parts = fullPath.split('/').filter(p => p);
    let currentNode = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const currentPath = '/' + parts.slice(0, index + 1).join('/');

      if (isLast) {
        // It's a file
        if (currentNode.children) {
            currentNode.children[part] = { name: part, type: 'file', path: currentPath, content };
        }
      } else {
        // It's a folder
         if (currentNode.children && !currentNode.children[part]) {
            currentNode.children[part] = { name: part, type: 'folder', path: currentPath, children: {} };
        }
        if (currentNode.children) {
            currentNode = currentNode.children[part];
        }
      }
    });
  });

  return root;
};


const FileTree: React.FC<{ node: TreeNode; onFileSelect: (file: TreeNode) => void; level?: number }> = ({ node, onFileSelect, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(level < 1); // Auto-open root and first level
    const isFolder = node.type === 'folder';

    const handleToggle = () => {
        if (isFolder) {
            setIsOpen(!isOpen);
        } else {
            onFileSelect(node);
        }
    };

    return (
        <div style={{ paddingLeft: `${level * 16}px` }}>
            <div onClick={handleToggle} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 rounded p-1">
                {isFolder ? (
                    <span className="text-purple-400">{isOpen ? '▼' : '►'}</span>
                ) : (
                    <FileCodeIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                )}
                <span className="truncate">{node.name}</span>
            </div>
            {isFolder && isOpen && node.children && (
                 <div className="border-l border-gray-700 ml-2">
                    {/* FIX: Explicitly cast to TreeNode[] to resolve type inference issues. */}
                    {(Object.values(node.children) as TreeNode[]).sort((a,b) => a.name.localeCompare(b.name)).map(child => (
                        <FileTree key={child.path} node={child} onFileSelect={onFileSelect} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};


const FileSystemTab: React.FC<FileSystemTabProps> = ({ state }) => {
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);

  const fileTree = useMemo(() => buildFileTree(state.virtualFileSystem), [state.virtualFileSystem]);
  
  return (
    <div className="p-4 text-sm h-full flex flex-col">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 h-full flex flex-row gap-4">
        <div className="w-1/3 border-r border-gray-700 pr-4 overflow-y-auto">
             <h3 className="font-bold mb-2 text-purple-300">Cognitive File System</h3>
             <FileTree node={fileTree} onFileSelect={setSelectedFile} />
        </div>
        <div className="w-2/3 flex flex-col">
            <h3 className="font-bold mb-2 text-purple-300">File Content</h3>
            {selectedFile ? (
                <div className="bg-gray-900 h-full rounded-md overflow-auto">
                    <pre className="p-4 text-sm whitespace-pre-wrap break-words">
                        <code>{selectedFile.content}</code>
                    </pre>
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Select a file to view its content.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FileSystemTab;