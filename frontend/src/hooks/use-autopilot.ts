import { useState } from "react";
import { saveAutopilotSettings } from "@/lib/api";

export function useAutopilot(enabled: boolean, onChanged: (enabled: boolean) => void) {
  const [showModal, setShowModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const doSave = async (val: boolean) => {
    setSaving(true);
    try {
      await saveAutopilotSettings({ enabled: val });
      onChanged(val);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleToggle = (val: boolean) => {
    if (val && !enabled) {
      setShowModal(true);
    } else {
      doSave(val);
    }
  };

  const handleConfirm = () => {
    if (!agreed) return;
    setShowModal(false);
    setAgreed(false);
    doSave(true);
  };

  const handleCancel = () => {
    setShowModal(false);
    setAgreed(false);
  };

  return { showModal, agreed, setAgreed, saving, handleToggle, handleConfirm, handleCancel };
}
