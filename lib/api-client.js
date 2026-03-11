export const api = {
    getSessions: async () => {
        const res = await fetch("/api/sessions");
        return res.json();
    },
    getSession: async (id) => {
        const res = await fetch(`/api/sessions/${id}`);
        return res.json();
    },
    createSession: async (title) => {
        const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
        });
        return res.json();
    },
    deleteSession: async (id) => {
        const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
        return res.json();
    },
    updateSession: async (id, patch) => {
        const res = await fetch(`/api/sessions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        return res.json();
    },
    uploadCV: async (sessionId, file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/sessions/${sessionId}/cvs`, {
            method: "POST",
            body: formData,
        });
        return res.json();
    },
    deleteCV: async (sessionId, cvId) => {
        const res = await fetch(`/api/sessions/${sessionId}/cvs/${cvId}`, {
            method: "DELETE",
        });
        return res.json();
    },
    sendChatMessage: async (sessionId, content) => {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        });
        return res.json();
    },
    researchCompany: async (sessionId, companyName, jobTitle) => {
        const res = await fetch(`/api/sessions/${sessionId}/research`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobTitle }),
        });
        return res.json();
    },
    suggestCV: async (sessionId) => {
        const res = await fetch(`/api/sessions/${sessionId}/suggest-cv`, {
            method: "POST",
        });
        return res.json();
    },
};
