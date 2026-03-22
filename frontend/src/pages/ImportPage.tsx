import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, CheckCircle, X,
  ChevronRight, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { previewImport, processImport, getImportSessions } from '../utils/api';
import type { ImportPreviewSheet, ColumnMapping } from '../types';
import { cn, formatDate } from '../utils/helpers';

type Step = 'upload' | 'preview' | 'importing' | 'done';

const SCHEMA_FIELDS = [
  'name_english', 'name_arabic', 'nickname',
  'ig_handle', 'ig_url', 'ig_followers', 'ig_rate',
  'tiktok_handle', 'tiktok_url', 'tiktok_followers', 'tiktok_rate',
  'snap_handle', 'snap_url', 'snap_followers', 'snapchat_rate',
  'fb_handle', 'fb_url', 'fb_followers', 'facebook_rate',
  'main_category', 'sub_category_1', 'account_tier',
  'package_rate', 'phone_number', 'email', 'way_of_contact',
  'nationality', 'country', 'city', 'address',
  'mawthouq_certificate', 'national_id',
  'profile_photo_url', 'internal_notes', 'tags', 'platform',
  'follower_count', 'price', 'link', '(skip)'
];

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewSheet[] | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importResult, setImportResult] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['import-sessions'],
    queryFn: getImportSessions,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const result = await previewImport(f);
      setPreview(result.sheets);
      setStep('preview');
    } catch (err) {
      toast.error(`Failed to parse file: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const handleImport = async () => {
    if (!file) return;
    setStep('importing');
    setLoading(true);
    try {
      const result = await processImport(file, columnOverrides, skipDuplicates);
      setImportResult(result as unknown as Record<string, number>);
      setStep('done');
      refetchSessions();
      toast.success(`Import complete: ${result.added} added, ${result.updated} updated`);
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setColumnOverrides({});
    setImportResult(null);
  };

  const sheet = preview?.[selectedSheet];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'importing', 'done'] as Step[]).map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
              step === s ? 'bg-white text-[#1c1c1c]' :
                ['preview', 'importing', 'done'].indexOf(step) > i ? 'bg-emerald-600 text-white' :
                  'bg-surface-overlay text-gray-500 border border-surface-border'
            )}>
              {['preview', 'importing', 'done'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            <span className={step === s ? 'text-white font-medium' : 'text-gray-500'}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-600" />}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
              isDragActive
                ? 'border-white/40 bg-white/5'
                : 'border-surface-border hover:border-white/20 hover:bg-surface-overlay'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            {loading ? (
              <p className="text-gray-400">Parsing file...</p>
            ) : isDragActive ? (
              <p className="text-white font-medium">Drop it here!</p>
            ) : (
              <>
                <p className="text-gray-200 font-medium mb-1">Drop Excel or CSV files here</p>
                <p className="text-gray-500 text-sm">or click to browse</p>
                <p className="text-gray-600 text-xs mt-3">Supports .xlsx, .xls, .csv — Max 50MB</p>
              </>
            )}
          </div>

          <div className="mt-6 p-4 bg-surface-overlay rounded-lg border border-surface-border">
            <h3 className="text-sm font-medium text-gray-200 mb-2">Smart Import Features</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Fuzzy column matching — maps column names even if spelled differently</li>
              <li>• Supports Arabic column headers (الاسم، انستقرام، عدد المتابعين...)</li>
              <li>• Auto-detects platform, handles, follower counts, and rates</li>
              <li>• Duplicate detection by handle and name similarity</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && sheet && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white">Column Mapping Preview</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  File: <strong className="text-gray-200">{file?.name}</strong> · {sheet.totalRows} rows
                </p>
              </div>
              {preview && preview.length > 1 && (
                <div className="flex gap-1">
                  {preview.map((s, i) => (
                    <button
                      key={i}
                      className={cn('btn-sm px-3 rounded-lg text-xs', i === selectedSheet ? 'btn-primary' : 'btn-secondary')}
                      onClick={() => setSelectedSheet(i)}
                    >
                      {s.sheetName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-overlay border-b border-surface-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-48">Original Column</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">→</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-48">Mapped To</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Confidence</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Sample Values</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {sheet.headers.map((h: ColumnMapping) => {
                    const override = columnOverrides[h.rawName];
                    const effective = override || h.mappedField;
                    const sampleValues = sheet.rows
                      .slice(0, 3)
                      .map(r => String(r[`_raw_${h.index}`] || ''))
                      .filter(v => v && v !== 'undefined');

                    return (
                      <tr key={h.index} className="hover:bg-surface-overlay/60">
                        <td className="px-3 py-2 text-xs text-gray-600">{h.index + 1}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'text-sm font-mono text-gray-200',
                            /[\u0600-\u06FF]/.test(h.rawName) ? 'arabic-text' : ''
                          )}>
                            {h.rawName || '(empty)'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">→</td>
                        <td className="px-3 py-2">
                          <select
                            className={cn(
                              'input text-xs py-1 w-44',
                              !effective ? 'border-amber-700/50 bg-amber-900/20' :
                                h.confidence >= 0.9 ? 'border-emerald-700/50 bg-emerald-900/20' :
                                  'border-blue-700/50 bg-blue-900/20'
                            )}
                            value={override || h.mappedField || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === h.mappedField) {
                                const { [h.rawName]: _, ...rest } = columnOverrides;
                                setColumnOverrides(rest);
                              } else {
                                setColumnOverrides(prev => ({ ...prev, [h.rawName]: val }));
                              }
                            }}
                          >
                            <option value="">(skip / unmapped)</option>
                            {SCHEMA_FIELDS.filter(f => f !== '(skip)').map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {effective ? (
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full',
                                    h.confidence >= 0.9 ? 'bg-emerald-500' :
                                    h.confidence >= 0.75 ? 'bg-blue-400' : 'bg-amber-400'
                                  )}
                                  style={{ width: `${Math.round(h.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{Math.round(h.confidence * 100)}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-400">unmapped</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-500 truncate max-w-[200px] block">
                            {sampleValues.slice(0, 2).join(' · ') || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 rounded accent-white"
                />
                Skip duplicates (don't update existing influencers)
              </label>
              <div className="flex gap-2">
                <button onClick={handleReset} className="btn-secondary">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleImport} disabled={loading} className="btn-primary">
                  Import {sheet.totalRows} Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="card p-12 text-center">
          <RefreshCw className="w-12 h-12 text-white mx-auto mb-4 animate-spin" />
          <h2 className="text-lg font-semibold text-white mb-2">Importing data...</h2>
          <p className="text-sm text-gray-400">This may take a moment for large files</p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && importResult && (
        <div className="card p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-6">Import Complete!</h2>
          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto mb-8">
            {[
              { label: 'Added',      value: importResult.added,      color: 'text-emerald-400' },
              { label: 'Updated',    value: importResult.updated,    color: 'text-blue-400' },
              { label: 'Duplicates', value: importResult.duplicates, color: 'text-amber-400' },
              { label: 'Errors',     value: importResult.errors,     color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="p-3 bg-surface-overlay rounded-lg border border-surface-border">
                <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
          {Boolean(importResult?.errorDetails) && Array.isArray(importResult?.errorDetails) &&
            (importResult.errorDetails as string[]).length > 0 && (
            <div className="text-left p-4 bg-red-900/20 border border-red-800/40 rounded-lg mb-6 max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-red-400 mb-1">Errors:</p>
              {(importResult.errorDetails as string[]).map((e: string, i: number) => (
                <p key={i} className="text-xs text-red-400/80">{e}</p>
              ))}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={handleReset} className="btn-secondary">Import Another File</button>
            <a href="/influencers" className="btn-primary">View Influencers</a>
          </div>
        </div>
      )}

      {/* Import History */}
      {step === 'upload' && sessions && (sessions as Array<Record<string, unknown>>).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-gray-300">Import History</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay/40 border-b border-surface-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">File</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Added</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Updated</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {(sessions as Array<Record<string, unknown>>).slice(0, 10).map((s: Record<string, unknown>) => (
                <tr key={String(s.id)} className="hover:bg-surface-overlay/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      <span className="text-gray-300 truncate max-w-[200px]">{String(s.filename)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(String(s.created_at))}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'badge',
                      s.status === 'completed' ? 'badge-green' :
                        s.status === 'failed' ? 'bg-red-900/40 text-red-400 border border-red-800/40' : 'badge-blue'
                    )}>
                      {String(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-emerald-400 font-medium">{String(s.added)}</td>
                  <td className="px-4 py-2.5 text-blue-400">{String(s.updated)}</td>
                  <td className="px-4 py-2.5 text-red-400">{String(s.errors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
