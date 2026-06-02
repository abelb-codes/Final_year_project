import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Upload, Send, Paperclip } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatDate } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { AcademicCase, CaseMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import FeedbackBanner from '../components/FeedbackBanner';

export default function CaseReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshDashboardStats } = useAuth();
  const [caseItem, setCaseItem] = useState<AcademicCase | null>(null);
  const [isCaseLoading, setIsCaseLoading] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationText, setConversationText] = useState('');
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;

    setIsCaseLoading(true);
    apiFetch<{ case: AcademicCase }>(`/api/cases/${id}/`)
      .then((response) => {
        setCaseItem(response.data.case);
        setRemarks(response.data.case.resolution_notes || '');
        setError('');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load case details.');
      })
      .finally(() => {
        setIsCaseLoading(false);
      });
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [caseItem?.messages]);

  const handleStatusUpdate = async (status: 'RS' | 'RJ') => {
    if (!caseItem) return;

    setIsSaving(true);
    try {
      const response = await apiFetch<{ case: AcademicCase }>(`/api/staff/cases/${caseItem.id}/status/`, {
        method: 'POST',
        body: {
          status,
          message: status === 'RS' ? 'Case approved by staff.' : 'Case rejected by staff.',
          resolution_notes: remarks,
        },
      });
      setCaseItem(response.data.case);
      setFeedback('Case updated successfully.');
      setError('');
      await refreshDashboardStats();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update case.');
    } finally {
      setIsSaving(false);
    }
  };

  const reloadCase = async () => {
    if (!id) return;
    const response = await apiFetch<{ case: AcademicCase }>(`/api/cases/${id}/`);
    setCaseItem(response.data.case);
  };

  const handleUpload = async () => {
    if (!caseItem || !selectedFile) {
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await apiFetch<{ case: AcademicCase }>(`/api/cases/${caseItem.id}/documents/`, {
        method: 'POST',
        body: formData,
      });
      setSelectedFile(null);
      setCaseItem(response.data.case);
      setFeedback('Document uploaded successfully.');
      setError('');
      await refreshDashboardStats();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!caseItem || (!conversationText.trim() && !messageFile)) {
      return;
    }

    setIsSendingMessage(true);

    const formData = new FormData();
    formData.append('message', conversationText);
    if (messageFile) {
      formData.append('file', messageFile);
    }

    try {
      const response = await apiFetch<{ message_item: CaseMessage }>(`/api/cases/${caseItem.id}/messages/`, {
        method: 'POST',
        body: formData,
      });

      setCaseItem((currentCase) =>
        currentCase
          ? {
              ...currentCase,
              messages: [...(currentCase.messages || []), response.data.message_item],
            }
          : currentCase,
      );
      setConversationText('');
      setMessageFile(null);
      setFeedback('Message sent successfully.');
      setError('');
      await refreshDashboardStats();
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : 'Unable to send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const formatTimestamp = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const isStaff = user?.role === 'staff';
  const messages = caseItem?.messages || [];

  if (isCaseLoading) {
    return <div className="p-8 text-center">Loading case...</div>;
  }

  if (!caseItem) {
    return <div className="p-8 text-center text-slate-500">Case not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-primary font-medium transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to list
      </button>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800">{isStaff ? 'Review Case' : 'Case Details'}</h1>
        <p className="text-slate-500">{caseItem.reference_code}</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Student Name</label>
              <p className="text-xl font-semibold text-slate-800">{caseItem.student.name}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Type</label>
                <p className="text-xl font-semibold text-slate-800">{caseItem.category_label}</p>
              </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject</label>
              <p className="text-xl font-semibold text-slate-800">{caseItem.title}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Submitted</label>
              <p className="text-xl font-semibold text-slate-800">{formatDate(caseItem.created_at)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</label>
              <p className={cn(
                'text-xl font-semibold',
                caseItem.status === 'RS' ? 'text-green-700' :
                caseItem.status === 'RJ' ? 'text-red-700' :
                caseItem.status === 'IP' ? 'text-blue-700' :
                'text-yellow-700'
              )}>
                {caseItem.status_label}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 leading-relaxed italic">
              {caseItem.description}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attached Documents</label>
            <div className="space-y-3">
              {caseItem.documents?.length ? (
                caseItem.documents.map((document) => (
                  <a
                    key={document.id}
                    href={document.file}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 border border-slate-100 rounded-xl bg-white shadow-sm w-fit group cursor-pointer hover:border-primary transition-colors"
                  >
                    <FileText className="w-5 h-5 text-red-500" />
                    <span className="text-primary font-medium underline underline-offset-4">{document.file}</span>
                  </a>
                ))
              ) : (
                <p className="text-slate-500">No documents uploaded.</p>
              )}
            </div>

            <div className="pt-2 space-y-3">
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full max-w-md px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                onClick={() => void handleUpload()}
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conversation</label>
                <p className="text-sm text-slate-500 mt-1">Use this thread to ask for clarification before closing the case.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
              {messages.length ? (
                <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                  {messages.map((message) => {
                    const isOwnMessage = message.sender.id === user?.id;

                    return (
                      <div
                        key={message.id}
                        className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                            isOwnMessage
                              ? 'bg-primary text-white rounded-br-md'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                          )}
                        >
                          <div className={cn('flex items-center justify-between gap-4', isOwnMessage ? 'text-white/80' : 'text-slate-500')}>
                            <p className="text-xs font-bold uppercase tracking-wider">{message.sender.name}</p>
                            <p className="text-xs">{formatTimestamp(message.created_at)}</p>
                          </div>

                          {message.message ? (
                            <p className={cn('mt-2 whitespace-pre-wrap leading-relaxed', isOwnMessage ? 'text-white' : 'text-slate-700')}>
                              {message.message}
                            </p>
                          ) : null}

                          {message.attachment ? (
                            <a
                              href={message.attachment}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                'mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                                isOwnMessage ? 'bg-white/15 text-white hover:bg-white/20' : 'bg-slate-100 text-primary hover:bg-slate-200'
                              )}
                            >
                              <Paperclip className="w-4 h-4" />
                              Open attachment
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
                  No messages yet
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <textarea
                value={conversationText}
                onChange={(e) => setConversationText(e.target.value)}
                placeholder={isStaff ? 'Ask the student for clarification or next steps...' : 'Reply to the staff handling your case...'}
                className="w-full h-28 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              />

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <input
                    type="file"
                    onChange={(e) => setMessageFile(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="w-full max-w-md px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {messageFile ? <p className="text-xs text-slate-500">Selected: {messageFile.name}</p> : null}
                </div>

                <button
                  onClick={() => void handleSendMessage()}
                  disabled={isSendingMessage || (!conversationText.trim() && !messageFile)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {isSendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {isStaff ? (
            <>
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Staff Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks or decision notes here..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => void handleStatusUpdate('RS')}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Approve
                </button>
                <button
                  onClick={() => void handleStatusUpdate('RJ')}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-60"
                >
                  <XCircle className="w-5 h-5" />
                  Reject
                </button>
              </div>
            </>
          ) : caseItem.resolution_notes ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resolution Notes</label>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 leading-relaxed">
                {caseItem.resolution_notes}
              </div>
            </div>
          ) : null}

          {caseItem.logs?.length ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activity Log</label>
              <div className="space-y-3">
                {caseItem.logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-800">{log.action_label}</p>
                    <p className="text-sm text-slate-600">{log.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {log.performed_by} on {formatDate(log.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
