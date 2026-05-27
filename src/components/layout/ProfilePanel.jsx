import { Camera, ExternalLink, Grip, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { categoryService } from "../../services/categoryService.js";
import { profileService } from "../../services/profileService.js";
import { mapCategory } from "../../utils/adapterUtils.js";
import { clearDashboardTileOrder, DEFAULT_DASHBOARD_TILE_ORDER, loadDashboardTileOrder, saveDashboardTileOrder } from "../../utils/dashboardPreferences.js";
import { resolveMediaUrl } from "../../utils/mediaUrl.js";
import { ROLE_LABELS } from "../../utils/permissions.js";
import Button from "../ui/Button.jsx";
import UserAvatar from "../ui/UserAvatar.jsx";

const DASHBOARD_CATEGORY_LABELS = {
  CT: "Corporate Tax",
  MIS: "MIS Reporting",
  EInv: "E-Invoicing",
  Refund: "VAT Refund",
};

function displayDashboardCategoryName(category) {
  return DASHBOARD_CATEGORY_LABELS[category?.name] || category?.name || "";
}

function InfoRow({ label, value }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-[14px] font-semibold text-slate-700">{value || "-"}</div>
    </div>
  );
}

function validateImageFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Selected file could not be opened as an image."));
    };
    image.src = objectUrl;
  });
}

export default function ProfilePanel({ open, initialTab = "profile", onClose }) {
  const { state, dispatch } = useApp();
  const { currentUser, setSessionUser } = useAuth();
  const [profile, setProfile] = useState(currentUser);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");
  const [dashboardTileOrder, setDashboardTileOrder] = useState(DEFAULT_DASHBOARD_TILE_ORDER);
  const [draggingTile, setDraggingTile] = useState("");
  const fileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const names = state.categories.map(displayDashboardCategoryName).filter(Boolean);
    setDashboardTileOrder(loadDashboardTileOrder(currentUser, names.length ? names : DEFAULT_DASHBOARD_TILE_ORDER));
  }, [currentUser, open, state.categories]);

  useEffect(() => {
    if (!open || activeTab !== "settings") return;
    categoryService.list()
      .then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) }))
      .catch(() => {});
  }, [activeTab, dispatch, open]);

  useEffect(() => {
    if (!open) return;
    setProfile(currentUser);
    let active = true;
    setLoading(true);
    profileService.getMe()
      .then((user) => {
        if (!active) return;
        setProfile(user);
        setSessionUser(user);
      })
      .catch(() => {
        if (active) toast.error("Unable to load profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, setSessionUser]);

  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "User";
  const joinedMobile = useMemo(() => [profile?.mobileCountryCode, profile?.mobile].filter(Boolean).join(" ").trim(), [profile]);
  const photoUrl = useMemo(() => resolveMediaUrl(profile?.profilePhotoUrl), [profile?.profilePhotoUrl]);
  const dashboardTileNames = useMemo(() => {
    const names = state.categories.map(displayDashboardCategoryName).filter(Boolean);
    return names.length ? names : DEFAULT_DASHBOARD_TILE_ORDER;
  }, [state.categories]);

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await validateImageFile(file);
      const user = await profileService.updatePhoto(file);
      setProfile(user);
      setSessionUser(user);
      setPreviewBroken(false);
      setPreviewSrc("");
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Unable to update profile photo.");
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
      setPreviewBroken(false);
      setPreviewSrc("");
      setPreviewOpen(false);
      toast.success("Profile photo removed.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to remove profile photo.");
    } finally {
      setUploading(false);
    }
  }

  function openFullImage() {
    if (!photoUrl) return;
    setPreviewBroken(false);
    setPreviewSrc(photoUrl);
    setPreviewOpen(true);
  }

  function handlePreviewError() {
    setPreviewBroken(true);
  }

  function moveDashboardTile(fromIndex, toIndex) {
    setDashboardTileOrder((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }

  function handleDashboardDragStart(event, name) {
    setDraggingTile(name);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", name);
  }

  function handleDashboardDragEnter(targetName) {
    if (!draggingTile || draggingTile === targetName) return;
    const fromIndex = dashboardTileOrder.indexOf(draggingTile);
    const toIndex = dashboardTileOrder.indexOf(targetName);
    moveDashboardTile(fromIndex, toIndex);
  }

  function handleDashboardDragEnd() {
    setDraggingTile("");
  }

  function handleSaveDashboardOrder() {
    const next = saveDashboardTileOrder(currentUser, dashboardTileOrder, dashboardTileNames);
    setDashboardTileOrder(next);
    toast.success("Dashboard card priority updated.");
  }

  function handleResetDashboardOrder() {
    const next = clearDashboardTileOrder(currentUser, dashboardTileNames);
    setDashboardTileOrder(next);
    toast.success("Dashboard card priority reset.");
  }

  if (!open) return null;

  return (
    <>
      <button className="fixed inset-0 z-40 bg-slate-950/35" onClick={onClose} aria-label="Close profile panel" />
      <aside className="fixed right-0 top-0 z-50 flex h-dvh w-full md:w-[50vw] md:max-w-[50vw] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[16px] font-extrabold text-slate-900">Profile</div>
            <div className="text-[12px] font-semibold text-slate-500">Account overview and settings</div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${activeTab === "profile" ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${activeTab === "settings" ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Settings
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="text-[14px] font-semibold text-slate-500">Loading profile...</div>
          ) : activeTab === "profile" ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
                <button
                  type="button"
                  className={`rounded-full ${photoUrl ? "cursor-zoom-in" : "cursor-default"}`}
                  onClick={openFullImage}
                  disabled={!photoUrl}
                  aria-label={photoUrl ? "Open full profile image" : "Profile avatar"}
                >
                  <UserAvatar user={profile} size="lg" className="shadow-md shadow-slate-200" />
                </button>
                <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">{roleLabel}</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <div className="mt-4 grid w-full gap-2">
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

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
                <InfoRow label="Name" value={profile?.name} />
                <InfoRow label="Email" value={profile?.email} />
                <InfoRow label="Mobile Number" value={joinedMobile} />
                <InfoRow label="Role" value={roleLabel} />
                <InfoRow label="Account Status" value={profile?.isActive ? "Active" : "Inactive"} />
                <InfoRow label="Last Login" value={profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "-"} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1e3a8a]">
                    <Camera size={18} />
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold text-slate-900">Profile Photo</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-500">Every user can manage their own profile photo from this panel.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                  <div className="text-[15px] font-extrabold text-slate-900">Protected Account Details</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-500">
                      Mobile number, role, and account status stay under admin access.
                  </div>
                  <div className="mt-4">
                    {profile?.role === "admin" ? (
                      <Button onClick={() => { onClose(); navigate("/settings/users"); }}>
                          <ExternalLink size={16} />
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
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Grip size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-extrabold text-slate-900">Dashboard Card Priority</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-500">
                      Drag cards into the order you want to see them.
                    </div>
                    <div className="mt-4 space-y-2">
                      {dashboardTileOrder.map((name, index) => (
                        <div
                          key={name}
                          draggable
                          onDragStart={(event) => handleDashboardDragStart(event, name)}
                          onDragEnter={() => handleDashboardDragEnter(name)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => event.preventDefault()}
                          onDragEnd={handleDashboardDragEnd}
                          className={`flex cursor-grab items-center gap-3 rounded-xl border px-3 py-2 transition active:cursor-grabbing ${
                            draggingTile === name
                              ? "border-[#1e3a8a] bg-blue-50/70 opacity-70"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                          }`}
                          title="Drag to reorder"
                        >
                          <div className="text-[11px] font-black text-slate-400">{String(index + 1).padStart(2, "0")}</div>
                          <div className="min-w-0 flex-1 text-[13px] font-bold text-slate-800">{name}</div>
                          <Grip size={16} className="shrink-0 text-slate-400" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={handleSaveDashboardOrder}>Save Priority</Button>
                      <Button variant="ghost" onClick={handleResetDashboardOrder}>
                        <RotateCcw size={16} />
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
      {previewOpen && previewSrc && (
        <>
          <button
            className="fixed inset-0 z-[60] bg-slate-950/75"
            onClick={() => {
              setPreviewOpen(false);
              setPreviewBroken(false);
            }}
            aria-label="Close image preview"
          />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-5 sm:p-8">
            <div className="relative w-full max-w-4xl rounded-3xl bg-white p-4 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewBroken(false);
                }}
                className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label="Close image preview"
              >
                <X size={16} />
              </button>
              {previewBroken ? (
                <div className="grid min-h-[320px] place-items-center rounded-2xl bg-slate-50 px-6 text-center">
                  <div>
                    <div className="text-[15px] font-extrabold text-slate-700">Unable to preview image</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-500">Please upload the image again.</div>
                  </div>
                </div>
              ) : (
                <div className="flex max-h-[82vh] items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-4">
                  <img
                    src={previewSrc}
                    alt={`${profile?.name || "User"} profile`}
                    className="max-h-[74vh] w-auto max-w-full object-contain"
                    onError={handlePreviewError}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
