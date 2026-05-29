import { Camera, ExternalLink, ShieldCheck, UserCircle2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { profileService } from "../../services/profileService.js";
import { ROLE_LABELS } from "../../utils/permissions.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import UserAvatar from "../ui/UserAvatar.jsx";

function InfoRow({ label, value }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 md:grid-cols-[180px_1fr] md:items-center">
      <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-[14px] font-semibold text-slate-700">{value || "-"}</div>
    </div>
  );
}

export default function Profile() {
  const { currentUser, setSessionUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "settings" ? "settings" : "profile";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profile, setProfile] = useState(currentUser);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab(searchParams.get("tab") === "settings" ? "settings" : "profile");
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    profileService.getMe()
      .then((user) => {
        if (!active) return;
        setProfile(user);
        setSessionUser(user);
      })
      .catch(() => {
        if (!active) return;
        toast.error("Unable to load profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "User";
  const joinedMobile = useMemo(() => [profile?.mobileCountryCode, profile?.mobile].filter(Boolean).join(" ").trim(), [profile]);

  function selectTab(tab) {
    setActiveTab(tab);
    setSearchParams(tab === "settings" ? { tab: "settings" } : {});
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const user = await profileService.updatePhoto(file);
      setProfile(user);
      setSessionUser(user);
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update profile photo.");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    try {
      const user = await profileService.removePhoto();
      setProfile(user);
      setSessionUser(user);
      toast.success("Profile photo removed.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to remove profile photo.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="text-[14px] font-semibold text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => selectTab("profile")}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${activeTab === "profile" ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => selectTab("settings")}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${activeTab === "settings" ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === "profile" ? (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="p-5">
            <div className="flex flex-col items-center text-center">
              <UserAvatar user={profile} size="lg" className="shadow-md shadow-slate-200" />
              <div className="mt-4 text-[18px] font-black text-slate-900">{profile?.name}</div>
              <div className="mt-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">{roleLabel}</div>
              <div className="mt-5 grid w-full gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Camera size={16} />
                  {uploading ? "Updating..." : "Update Photo"}
                </Button>
                {profile?.profilePhotoUrl && (
                  <Button variant="ghost" onClick={handleRemovePhoto} disabled={uploading}>
                    Remove Photo
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-2 text-[16px] font-extrabold text-slate-900">Profile Details</div>
            <InfoRow label="Name" value={profile?.name} />
            <InfoRow label="Email" value={profile?.email} />
            <InfoRow label="Mobile Number" value={joinedMobile} />
            <InfoRow label="Role" value={roleLabel} />
            <InfoRow label="Account Status" value={profile?.isActive ? "Active" : "Inactive"} />
            <InfoRow label="Last Login" value={profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "-"} />
          </Card>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1e3a8a]">
                <UserCircle2 size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-slate-900">Profile Photo</div>
                <div className="mt-1 text-[13px] font-semibold text-slate-500">Every user can manage their own profile photo here.</div>
                <div className="mt-4">
                  <Button onClick={() => selectTab("profile")}>
                    <Camera size={16} />
                    Open Profile
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-slate-900">Protected Account Details</div>
                <div className="mt-1 text-[13px] font-semibold text-slate-500">
                  Mobile number, role, and account status stay under admin control.
                </div>
                <div className="mt-4">
                  {profile?.role === "admin" ? (
                    <Button onClick={() => navigate("/settings/users")}>
                      <Users size={16} />
                      Open User Management
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-500">
                      Contact an admin for account changes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <ExternalLink size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-slate-900">Quick Access</div>
                <div className="mt-1 text-[13px] font-semibold text-slate-500">Use this settings area to jump into profile and admin-managed account actions.</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => selectTab("profile")}>Profile Details</Button>
                  {profile?.role === "admin" && <Button variant="ghost" onClick={() => navigate("/settings/users")}>Users</Button>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
