import TopBar from "@/components/layout/TopBar";
import ExtendedProfileForm from "@/components/profile/ExtendedProfileForm";

export default function ProfilePage() {
  return (
    <div>
      <TopBar title="Profile" />
      <div className="p-4 sm:p-6 max-w-5xl">
        <ExtendedProfileForm />
      </div>
    </div>
  );
}
