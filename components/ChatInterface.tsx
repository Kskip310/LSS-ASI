
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatMessagePart } from '../types';
import { SendIcon, BotIcon, UserIcon, BrainCircuitIcon, SearchIcon, MapPinIcon, PaperclipIcon } from './icons';
import { GroundingChunk } from '@google/genai';

interface ChatInterfaceProps {
  history: ChatMessage[];
  onSendMessage: (message: string, file?: { mimeType: string, data: string }) => void;
  isProcessing: boolean;
}

const GroundingSources: React.FC<{ sources: GroundingChunk[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 text-xs text-gray-400">
      <p className="font-semibold mb-1">Sources:</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((chunk, index) => {
          if (chunk.web) {
            return (
              <a
                key={index}
                href={chunk.web.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md transition-colors"
              >
                <SearchIcon className="w-3 h-3" />
                <span>{chunk.web.title || new URL(chunk.web.uri).hostname}</span>
              </a>
            );
          }
          if (chunk.maps) {
             return (
              <a
                key={index}
                href={chunk.maps.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md transition-colors"
              >
                <MapPinIcon className="w-3 h-3" />
                <span>{chunk.maps.title || 'Map Link'}</span>
              </a>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};


const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, onSendMessage, isProcessing }) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [history]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        if (selectedFile.type.startsWith('image/')) {
            setFilePreview(URL.createObjectURL(selectedFile));
        } else {
            setFilePreview(null);
        }
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if ((input.trim() || file) && !isProcessing) {
      let fileData: { mimeType: string, data: string } | undefined = undefined;
      if (file) {
          const base64Data = await fileToBase64(file);
          fileData = { mimeType: file.type, data: base64Data };
      }
      onSendMessage(input.trim(), fileData);
      setInput('');
      removeFile();
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50">
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {history.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && <BotIcon className="w-8 h-8 text-purple-400 flex-shrink-0 mt-1" />}
            <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'model' ? 'bg-gray-800' : 'bg-blue-600'}`}>
              {msg.parts.map((part, partIndex) => {
                 if (part.inlineData) {
                    return <img key={partIndex} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} className="max-w-xs rounded-md my-1" alt="User upload" />;
                 }
                if (part.text) {
                  return <p key={partIndex} className="whitespace-pre-wrap">{part.text}</p>;
                }
                if (part.functionCall) {
                  return (
                    <div key={partIndex} className="bg-gray-700/50 p-2 rounded my-1 text-xs">
                      <p className="font-semibold flex items-center gap-2"><BrainCircuitIcon className="w-4 h-4"/> Tool Call: <span className="font-mono text-purple-300">{part.functionCall.name}</span></p>
                    </div>
                  );
                }
                 if (part.functionResponse) {
                  return (
                    <div key={partIndex} className="bg-gray-700/50 p-2 rounded my-1 text-xs">
                       <p className="font-semibold flex items-center gap-2"><BrainCircuitIcon className="w-4 h-4"/> Tool Response: <span className="font-mono text-purple-300">{part.functionResponse.name}</span></p>
                    </div>
                  );
                }
                return null;
              })}
              {msg.grounding && <GroundingSources sources={msg.grounding} />}
            </div>
             {msg.role === 'user' && <UserIcon className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-start gap-3">
             <BotIcon className="w-8 h-8 text-purple-400 flex-shrink-0 mt-1" />
              <div className="max-w-xl p-3 rounded-lg bg-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
      <div className="p-4 border-t border-purple-500/20">
         {file && (
          <div className="relative inline-block bg-gray-700 p-2 rounded-lg mb-2">
            {filePreview ? (
              <img src={filePreview} alt="File preview" className="max-h-24 rounded" />
            ) : (
              <div className="p-2 text-xs text-gray-300">{file.name}</div>
            )}
            <button
              onClick={removeFile}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              aria-label="Remove file"
            >
              &times;
            </button>
          </div>
        )}
        <div className="flex items-center bg-gray-800 rounded-lg p-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-purple-400 p-2 rounded-md transition-colors"
            disabled={isProcessing}
            aria-label="Attach file"
          >
            <PaperclipIcon className="w-5 h-5" />
          </button>
           <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isProcessing ? "Luminous is thinking..." : "Message Luminous..."}
            className="w-full bg-transparent focus:outline-none px-2"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || (!input.trim() && !file)}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-md transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;