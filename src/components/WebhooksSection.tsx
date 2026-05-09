import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, Play, CheckCircle2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { buildBackendUrl } from '../lib/backend';
import { cn } from '../lib/utils';

export function WebhooksSection({ isDark, currentUserProfile }: { isDark: boolean, currentUserProfile: any }) {
  const [webhookUrl, setWebhookUrl] = useState(currentUserProfile?.webhookUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const parseResponseBody = async (response: Response) => {
    const responseText = await response.text();
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  };

  useEffect(() => {
    setWebhookUrl(currentUserProfile?.webhookUrl || '');
  }, [currentUserProfile]);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        webhookUrl: webhookUrl.trim()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      console.error("Error saving webhook URL:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    const trimmedWebhookUrl = webhookUrl.trim();
    if (!trimmedWebhookUrl) {
      setTestResult({ success: false, message: 'Please enter a webhook URL first.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const samplePayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "1234567890",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "1234567890",
                  phone_number_id: "1234567890"
                },
                contacts: [
                  {
                    profile: {
                      name: "Test User"
                    },
                    wa_id: "1234567890"
                  }
                ],
                messages: [
                  {
                    from: "1234567890",
                    id: "wamid.HBgLMTIzNDU2Nzg5MBUCABIYI...",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: {
                      body: "This is a test message from Visionary Webhook Tester."
                    },
                    type: "text"
                  }
                ]
              },
              field: "messages"
            }
          ]
        }
      ]
    };

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      const response = await fetch(buildBackendUrl('/api/webhooks/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookUrl: trimmedWebhookUrl,
          payload: samplePayload
        }),
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);

      const responseBody = await parseResponseBody(response);
      const responseMessage =
        typeof responseBody === 'object' && responseBody && 'message' in responseBody
          ? String(responseBody.message)
          : `Received status code: ${response.status} ${response.statusText}`;

      setTestResult({
        success: response.ok && Boolean(typeof responseBody === 'object' && responseBody && 'success' in responseBody ? responseBody.success : true),
        message: responseMessage
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error && error.name === 'AbortError'
          ? 'Webhook test timed out after 12 seconds.'
          : (error instanceof Error ? error.message : 'Failed to reach webhook URL')
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <motion.div 
      key="webhooks"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl space-y-6 md:space-y-8"
    >
      <div className={cn("rounded-2xl md:rounded-3xl p-6 md:p-8 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
        <div className="flex items-center gap-3 mb-6">
          <LinkIcon className="text-blue-500" />
          <h2 className="text-xl md:text-2xl font-bold">Webhook Configuration</h2>
        </div>
        
        <p className={cn("mb-6", isDark ? "text-gray-400" : "text-gray-600")}>
          Configure a webhook URL to receive real-time updates when events happen in your WhatsApp Business Account, such as incoming messages or status updates.
        </p>

        <div className="space-y-4">
          <div>
            <label className={cn("block text-sm font-medium mb-2", isDark ? "text-gray-300" : "text-gray-700")}>
              Webhook URL
            </label>
            <div className="flex gap-3">
              <input 
                type="url" 
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/webhook"
                className={cn(
                  "flex-1 p-3 rounded-xl border outline-none transition-all",
                  isDark ? "bg-gray-800/50 border-gray-700 focus:border-blue-500" : "bg-gray-50 border-gray-200 focus:border-blue-500"
                )}
              />
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-5 h-5" /> : <Save size={18} />}
                Save
              </button>
            </div>
            {saveSuccess && (
              <p className="text-[#5B45FF] text-sm mt-2 flex items-center gap-1">
                <CheckCircle2 size={14} /> Webhook URL saved successfully
              </p>
            )}
          </div>

          <div className={cn("p-6 rounded-xl border mt-8", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <h3 className="text-lg font-semibold mb-2">Test Webhook</h3>
            <p className={cn("text-sm mb-4", isDark ? "text-gray-400" : "text-gray-600")}>
              Send a sample WhatsApp message payload to your configured webhook URL to verify it's working correctly.
            </p>
            
            <button 
              onClick={handleTest}
              disabled={isTesting || !webhookUrl.trim()}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isTesting ? <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-5 h-5" /> : <Play size={18} />}
              Send Test Payload
            </button>

            {testResult && (
              <div className={cn(
                "mt-4 p-4 rounded-lg flex items-start gap-3",
                testResult.success 
                  ? (isDark ? "bg-[#5B45FF]/10 text-[#5B45FF] border border-[#5B45FF]/20" : "bg-[#5B45FF] text-white border border-[#5B45FF]")
                  : (isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-700 border border-red-200")
              )}>
                {testResult.success ? <CheckCircle2 className="shrink-0 mt-0.5" size={18} /> : <AlertCircle className="shrink-0 mt-0.5" size={18} />}
                <div>
                  <p className="font-medium">{testResult.success ? 'Test Successful' : 'Test Failed'}</p>
                  <p className="text-sm opacity-90">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
