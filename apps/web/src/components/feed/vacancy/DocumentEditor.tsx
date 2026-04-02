"use client";

/**
 * DocumentEditor — embeds the ONLYOFFICE Document Editor via their public JS API.
 *
 * How it works:
 *  1. We receive an `onlyofficeConfig` from the backend (JWT-signed).
 *  2. We dynamically load `api.js` from the ONLYOFFICE server.
 *  3. We call `new DocsAPI.DocEditor(containerId, config)` once the script is ready.
 *  4. When the user saves inside ONLYOFFICE, the server calls our callback endpoint
 *     which overwrites the editable DOCX file.
 *
 * Fallback: if ONLYOFFICE is unavailable (no server configured), we render nothing
 * and the parent falls back to the contentEditable HTML preview.
 */

import { useEffect, useRef, useState, useId } from "react";
import type { OnlyOfficeConfig } from "@/types";

interface DocumentEditorProps {
  config: OnlyOfficeConfig;
  onReady?: () => void;
  onError?: (message: string) => void;
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: object) => { destroyEditor?: () => void };
    };
  }
}

export default function DocumentEditor({ config, onReady, onError }: DocumentEditorProps) {
  const containerId = useId().replace(/:/g, "oo");
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const serverUrl = config._server_url || process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080";
  const scriptSrc = `${serverUrl}/web-apps/apps/api/documents/api.js`;

  useEffect(() => {
    let destroyed = false;

    // Build the config without our internal `_server_url` key (not part of ONLYOFFICE spec)
    const { _server_url: _omit, ...ooConfig } = config as OnlyOfficeConfig & { _server_url?: string };

    function initEditor() {
      if (destroyed || !window.DocsAPI) return;
      try {
        const container = document.getElementById(containerId);
        if (!container) return;
        // Destroy previous instance if any
        editorRef.current?.destroyEditor?.();
        editorRef.current = new window.DocsAPI.DocEditor(containerId, ooConfig);
        setStatus("ready");
        onReady?.();
      } catch (e) {
        setStatus("error");
        onError?.("Failed to initialize document editor.");
      }
    }

    // If the script is already loaded (e.g. on re-render), init immediately
    if (window.DocsAPI) {
      initEditor();
      return;
    }

    // Check if script tag already exists (prevents duplicate loads)
    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existing) {
      existing.addEventListener("load", initEditor);
      return () => { destroyed = true; existing.removeEventListener("load", initEditor); };
    }

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = initEditor;
    script.onerror = () => {
      setStatus("error");
      onError?.(`Could not reach the ONLYOFFICE server at ${serverUrl}. Make sure it is running (docker compose up).`);
    };
    document.head.appendChild(script);

    return () => {
      destroyed = true;
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
    };
  }, [config.document?.key]);  // re-init only when document key changes (new version)

  return (
    <div className="relative w-full h-full min-h-[600px]">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading document editor…</p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10 px-8">
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-sm font-medium text-foreground">Document editor unavailable</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Make sure the ONLYOFFICE container is running:<br />
              <code className="bg-muted px-1 rounded text-[11px]">docker compose up onlyoffice</code>
            </p>
          </div>
        </div>
      )}
      {/* ONLYOFFICE mounts itself into this div */}
      <div id={containerId} className="w-full h-full" />
    </div>
  );
}
