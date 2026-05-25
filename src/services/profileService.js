import api from "./api";

export const profileService = {
  getMe: () => api.get("/profile/me").then((res) => res.data.user),
  updatePhoto: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.patch("/profile/me/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((res) => res.data.user);
  },
  removePhoto: () => api.delete("/profile/me/photo").then((res) => res.data.user),
};
