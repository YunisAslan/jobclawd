import { useState } from "react";
import { SMTPSettings } from "@/types";
import { saveSMTPSettings } from "@/lib/api";

const DEFAULT_SMTP: SMTPSettings = {
  host: "",
  port: 587,
  username: "",
  password: "",
  from_name: "JobClawd",
};

export function useSMTPForm(initial: SMTPSettings | null) {
  const [form, setForm] = useState<SMTPSettings>(initial ?? DEFAULT_SMTP);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof SMTPSettings, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveSMTPSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return { form, showPassword, setShowPassword, saving, saved, error, update, handleSave };
}
