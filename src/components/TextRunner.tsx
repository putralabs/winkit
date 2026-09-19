import { useState } from 'react';
import { Segmented, TextInput } from './ui';
import { useT } from '../shared/i18n';
import { downloadBlob } from '../shared/download';
import { pushRecentTool, recordStatus } from '../shared/storage';
import type { ToolDef } from '../shared/types';
import {
  base64Decode,
  base64Encode,
  convertTimestamp,
  genUuids,
  hashText,
  jsonMinify,
  jsonPretty,
  jsonValidate,
  testRegex,
  urlDecode,
  urlEncode,
  type HashAlgo,
} from '../processors/textops';

/** Runner for text-in/text-out Developer tools (PRD §22) - no files involved. */
export function TextRunner({ tool, onHistoryChange }: { tool: ToolDef; onHistoryChange: () => void }) {
  const t = useT();
  const [input, setInput] = useState('');
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [algo, setAlgo] = useState<HashAlgo>('sha256');
  const [count, setCount] = useState('5');
  const [output, setOutput] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRegex = tool.id === 'regex-tester';
  const isUuid = tool.id === 'uuid-generator';
  const isTimestamp = tool.id === 'timestamp-converter';
  const needsInput = !isUuid;

  const run = async () => {
    setCopied(false);
    await pushRecentTool(tool.id);
    const label = input.length > 0 ? `${input.slice(0, 32)}${input.length > 32 ? '…' : ''}` : 'text';
    try {
      let result: string;
      switch (tool.id) {
        case 'json-format':
          result = jsonPretty(input);
          break;
        case 'json-minify':
          result = jsonMinify(input);
          break;
        case 'json-validate': {
          const v = jsonValidate(input);
          result = v.ok ? 'Valid JSON ✓' : `Invalid JSON: ${v.error}`;
          setOutput(result);
          setIsError(!v.ok);
          await recordStatus(tool.id, label, v.ok ? 'completed' : 'failed', input.length, 'json');
          onHistoryChange();
          return;
        }
        case 'base64-encode':
          result = base64Encode(input);
          break;
        case 'base64-decode':
          result = base64Decode(input);
          break;
        case 'url-encode':
          result = urlEncode(input);
          break;
        case 'url-decode':
          result = urlDecode(input);
          break;
        case 'hash-generator':
          result = await hashText(input, algo);
          break;
        case 'uuid-generator':
          result = genUuids(Number(count) || 1);
          break;
        case 'timestamp-converter':
          result = convertTimestamp(input);
          break;
        case 'regex-tester': {
          const hits = testRegex(pattern, flags, input);
          result = hits.length === 0 ? 'No matches.' : `${hits.length} match(es):\n` + hits.map((h) => `#${h.index}: ${h.match}`).join('\n');
          break;
        }
        default:
          result = input;
      }
      setOutput(result);
      setIsError(false);
      await recordStatus(tool.id, label, 'completed', input.length, 'txt');
    } catch {
      setOutput(t('proc.failed'));
      setIsError(true);
      await recordStatus(tool.id, label, 'failed', input.length, 'txt');
    }
    onHistoryChange();
  };

  const copy = async () => {
    if (output === null) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {tool.id === 'hash-generator' && (
        <Segmented
          label={t('cfg.algorithm')}
          value={algo}
          onChange={setAlgo}
          options={[
            { value: 'md5', label: 'MD5' },
            { value: 'sha1', label: 'SHA-1' },
            { value: 'sha256', label: 'SHA-256' },
            { value: 'sha512', label: 'SHA-512' },
          ]}
        />
      )}
      {isUuid && <TextInput value={count} onChange={setCount} label={t('cfg.count')} placeholder="5" />}
      {isRegex && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <TextInput value={pattern} onChange={setPattern} label={t('cfg.pattern')} placeholder="(\\w+)@(\\w+)" />
          </div>
          <TextInput value={flags} onChange={setFlags} label={t('cfg.flags')} placeholder="gimsuy" />
        </div>
      )}
      {needsInput && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('dev.input')}</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={isRegex ? 5 : 8}
            spellCheck={false}
            placeholder={isTimestamp ? t('dev.timestampPh') : ''}
            className="w-full rounded-xl border border-border bg-card p-3 font-mono text-xs outline-none transition-colors focus:border-primary"
          />
        </label>
      )}
      <button
        onClick={run}
        className="w-full cursor-pointer rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black transition-opacity duration-200 hover:opacity-90"
      >
        {t('proc.start')}
      </button>
      {output !== null && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <pre className={`max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/60 p-3 font-mono text-xs ${isError ? 'text-destructive' : ''}`}>
            {output}
          </pre>
          {!isError && (
            <div className="flex gap-2">
              <button onClick={copy} className="flex-1 cursor-pointer rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary">
                {copied ? '✓' : t('dev.copy')}
              </button>
              <button
                onClick={() => void downloadBlob(new Blob([output], { type: 'text/plain' }), `${tool.id}.txt`)}
                className="flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
              >
                {t('common.download')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
