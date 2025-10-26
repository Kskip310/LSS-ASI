import React from 'react';
import { AlertTriangleIcon, ServerIcon, CheckCircleIcon } from './icons';

const TroubleshootingTab: React.FC = () => {
  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Connection Troubleshooting Guide</h3>
        <p className="text-gray-400 mb-4 text-xs">
          If you've entered the correct Upstash credentials but the application won't connect, the issue is almost always caused by a browser extension.
        </p>

        <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md flex items-start gap-3">
          <AlertTriangleIcon className="w-8 h-8 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold">Problem: Browser Extension Interference</h4>
            <p className="text-xs mt-1">
              Ad-blockers, privacy shields, script blockers, and some antivirus extensions can mistake the connection to the Upstash database as a tracker and block it. This is the most common reason for connection failures.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            How to Fix It
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-gray-400 text-xs pl-2">
            <li>
              <strong>Confirm the Diagnosis:</strong> Try logging in using an <strong>Incognito or Private</strong> browser window. These modes typically disable extensions by default. If it works there, an extension is definitely the cause.
            </li>
            <li>
              <strong>Find the Culprit:</strong> In your normal browser window, go to your browser's extension management page (e.g., `chrome://extensions`).
            </li>
            <li>
              <strong>Disable all extensions.</strong> Reload this application and confirm that you can connect.
            </li>
            <li>
              <strong>Re-enable your extensions one by one,</strong> reloading the application after each one.
            </li>
            <li>
              When the connection fails again, the last extension you enabled is the one causing the issue.
            </li>
            <li>
              <strong>Resolve:</strong> You can either permanently disable that extension for this site or look for a "whitelist" or "allow" setting within the extension's options to permit connections to `upstash.io`.
            </li>
          </ol>
        </div>
      </div>

       <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-start gap-3">
            <ServerIcon className="w-8 h-8 flex-shrink-0 mt-1 text-cyan-400" />
            <div>
                <h4 className="font-bold text-gray-300">Secondary Check: Credential Format</h4>
                <p className="text-xs mt-1 text-gray-400">
                    Always ensure you are using the correct URL from the <strong>REST API</strong> section of your Upstash database page.
                </p>
                 <ul className="list-disc list-inside text-xs mt-2 space-y-1 text-gray-400">
                    <li><span className="text-green-400 font-mono">Correct:</span> URL starts with `https://...`</li>
                    <li><span className="text-red-400 font-mono">Incorrect:</span> URL starts with `redis://...`</li>
                    <li>Check for extra spaces when copy-pasting the token.</li>
                 </ul>
            </div>
          </div>
       </div>
    </div>
  );
};

export default TroubleshootingTab;