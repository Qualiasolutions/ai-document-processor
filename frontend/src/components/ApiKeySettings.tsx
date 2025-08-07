import React from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Settings, Shield, Check } from 'lucide-react';

/**
 * Secure API Settings Component
 * Shows information about server-side security instead of allowing API key input
 */
export function ApiKeySettings() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Security Info
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Secure Configuration
          </DialogTitle>
          <DialogDescription>
            Your application is configured with enterprise-grade security.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">✅ Security Features Active</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                Server-side API key management
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                Zero client-side secret exposure  
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                Encrypted environment variables
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                HTTPS-only communication
              </li>
            </ul>
          </div>
          
          <div className="text-sm text-gray-600 space-y-2">
            <div>
              <strong>How it works:</strong>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>All AI processing happens on secure servers</li>
                <li>Your documents are analyzed server-side</li>
                <li>No API keys are stored in your browser</li>
                <li>Professional-grade security standards</li>
              </ul>
            </div>
            
            <div className="pt-2 border-t">
              <strong>Benefits:</strong>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>No setup required from users</li>
                <li>Enterprise security by default</li>
                <li>Consistent performance</li>
                <li>No API key management needed</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}