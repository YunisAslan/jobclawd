import { useState, useEffect } from "react";
import { SMTPSettings } from "@/components/settings/types";
import { settingsService } from "@/services/settings.service";
import { extractApiError } from "@/lib/utils";

export function useSMTPForm() {
  const [form, setForm] = useState<Partial<SMTPSettings>>({
    host: "smtp.gmail.com",
    port: 587,
    username: "",
    password: "",
    from_name: "",
  });

  const [savedUsername, setSavedUsername] = useState<string>("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsService.getSMTP()
      .then((data) => {
        setForm({ ...data, password: "" });
        setPasswordSaved(true);
        setSavedUsername(data.username ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof SMTPSettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.username) {
      setError("Gmail address is required.");
      return;
    }
    if (!passwordSaved && !form.password) {
      setError("App password is required.");
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await settingsService.saveSMTP({
        host: form.host || "smtp.gmail.com",
        port: form.port || 587,
        username: form.username,
        password: form.password || undefined,
        from_name: form.from_name || form.username,
      });
      setPasswordSaved(true);
      setEditingPassword(false);
      setSavedUsername(form.username ?? "");
      setForm((prev) => ({ ...prev, password: "" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(extractApiError(e, "Failed to save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await settingsService.deleteSMTP();
      setSavedUsername("");
      setPasswordSaved(false);
      setEditingPassword(false);
      setForm({ host: "smtp.gmail.com", port: 587, username: "", password: "", from_name: "" });
    } catch (e: unknown) {
      setError(extractApiError(e, "Failed to disconnect. Please try again."));
    } finally {
      setDisconnecting(false);
    }
  };

  return {
    form,
    loading,
    savedUsername,
    passwordSaved,
    editingPassword,
    setEditingPassword,
    showPassword,
    setShowPassword,
    saving,
    saved,
    disconnecting,
    error,
    update,
    handleSave,
    handleDisconnect,
  };
}
