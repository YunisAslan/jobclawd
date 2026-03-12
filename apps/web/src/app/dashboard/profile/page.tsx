import TopBar from "@/components/layout/TopBar";
import ExtendedProfileForm from "@/components/profile/ExtendedProfileForm";

export default function ProfilePage() {
  return (
    <div>
      <TopBar title="Profile" />
      <div className="p-6 max-w-5xl">
        <ExtendedProfileForm />
      </div>
    </div>
  );
}
