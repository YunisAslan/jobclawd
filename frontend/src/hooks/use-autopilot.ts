import { useState } from "react";

export function useAutopilot(
  initialEnabled: boolean,
  onChanged: (enabled: boolean) => void,
) {
  const [, setEnabled] = useState(initialEnabled);
  const [showModal, setShowModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      setShowModal(true);
    } else {
      setEnabled(false);
      onChanged(false);
    }
  };

  const handleConfirm = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setEnabled(true);
      setShowModal(false);
      onChanged(true);
    }, 500);
  };

  const handleCancel = () => {
    setShowModal(false);
    setAgreed(false);
  };

  return {
    showModal,
    agreed,
    setAgreed,
    saving,
    handleToggle,
    handleConfirm,
    handleCancel,
  };
}
