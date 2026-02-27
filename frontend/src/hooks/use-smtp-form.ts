import { useState } from "react";
import { SMTPSettings } from "@/types";

export function useSMTPForm(initial: SMTPSettings | null) {
  const [form, setForm] = useState<Partial<SMTPSettings>>(
    initial || {
      host: "",
      port: 587,
      username: "",
      password: "",
      from_name: "JobClawd",
    },
  );

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof SMTPSettings, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.host || !form.username || !form.password) {
      setError("Please fill out all required fields.");
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);

    // Mock save
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  return {
    form,
    showPassword,
    setShowPassword,
    saving,
    saved,
    error,
    update,
    handleSave,
  };
}
