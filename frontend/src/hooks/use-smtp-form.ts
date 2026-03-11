import { useState, useEffect } from "react";
import { SMTPSettings } from "@/components/settings/types";
import { settingsService } from "@/services/settings.service";

export function useSMTPForm() {
  const [form, setForm] = useState<Partial<SMTPSettings>>({
    host: "smtp.gmail.com",
    port: 587,
    username: "",
    password: "",
    from_name: "",
  });

  // The username that was last confirmed saved to the backend
  const [savedUsername, setSavedUsername] = useState<string>("");
  // true = a password is already stored in the backend (we never receive it back)
  const [passwordSaved, setPasswordSaved] = useState(false);
  // true = user is actively changing the password
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
        // Password is omitted from GET response — keep field empty but mark as saved
        setForm({ ...data, password: "" });
        setPasswordSaved(true);
        setSavedUsername(data.username ?? "");
      })
      .catch(() => {}) // 404 = not configured yet, keep defaults
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof SMTPSettings, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.username) {
      setError("Gmail address is required.");
      return;
    }
    // Need a password either already saved or freshly entered
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
        // Only send password if user actually typed a new one
        password: form.password || undefined,
        from_name: form.from_name || form.username,
      });
      setPasswordSaved(true);
      setEditingPassword(false);
      setSavedUsername(form.username ?? "");
      setForm((prev) => ({ ...prev, password: "" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save. Please try again.");
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
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to disconnect. Please try again.");
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
