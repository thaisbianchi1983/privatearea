import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  collection,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/** Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyBu4_6-QirTzY7GK2bcoZWJkAQyZGtNk6s",
  authDomain: "privatearea-5a498.firebaseapp.com",
  projectId: "privatearea-5a498",
  storageBucket: "privatearea-5a498.firebasestorage.app",
  messagingSenderId: "456227099445",
  appId: "1:456227099445:web:be79819ba19424c113f27c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const page = location.pathname.split("/").pop();

const $ = (sel) => document.querySelector(sel);
const setStatus = (msg) => {
  const el = $("#status") || $("#msg");
  if (el) el.textContent = msg || "";
};

// mostra erro na tela e no console (pra não “sumir”)
const showError = (label, err) => {
  console.error(label, err);
  const msg = (err && err.message) ? err.message : String(err);
  alert(`${label}: ${msg}`);
  setStatus(`${label}: ${msg}`);
};

function getIdParam() {
  return new URLSearchParams(location.search).get("id");
}

async function requireActiveUser(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error("Usuário não autorizado (não existe em users).");
  const data = snap.data();
  if (data.active !== true) throw new Error("Usuário inativo.");
  return data;
}

/** PROTEÇÃO ADMIN */
onAuthStateChanged(auth, async (user) => {
  const isAdminPage = location.pathname.includes("/admin/");
  if (!isAdminPage) return;

  if (!user) {
    if (page !== "login.html") location.href = "./login.html";
    return;
  }

  try {
    await requireActiveUser(user);
  } catch (err) {
    showError("Acesso negado", err);
    await signOut(auth);
    location.href = "./login.html";
  }
});

/** LOGOUT */
const logoutBtn = $("#logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      location.href = "./login.html";
    } catch (err) {
      showError("Erro ao sair", err);
    }
  });
}

/** LOGIN */
if (page === "login.html") {
  const loginForm = $("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailEl = document.getElementById("email");
      const passEl = document.getElementById("password");

      if (!emailEl || !passEl) {
        alert('Login: faltou id="email" e/ou id="password".');
        return;
      }

      const email = emailEl.value.trim();
      const password = passEl.value;

      try {
        setStatus("Entrando...");
        await signInWithEmailAndPassword(auth, email, password);
        location.href = "./dashboard.html";
      } catch (err) {
        showError("Erro no login", err);
      }
    });
  }
}

/** PASSO 1: salvar imóvel e ir para mídia */
if (page === "property-new.html") {
  // garante que DOM carregou antes de procurar elementos
  window.addEventListener("DOMContentLoaded", () => {
    console.log("admin.js OK ✅ em", page);

    const form = document.getElementById("propertyForm");
    const saveBtn = document.getElementById("saveBtn");

    if (!form) {
      alert('ERRO: Não existe <form id="propertyForm"> nesta página.');
      return;
    }

    const handleSave = async (e) => {
      if (e) e.preventDefault();

      const title = (document.getElementById("title")?.value || "").trim();
      const priceRaw = document.getElementById("price")?.value;
      const price = Number(priceRaw);
      const city = (document.getElementById("city")?.value || "").trim();
      const neighborhood = (document.getElementById("neighborhood")?.value || "").trim();
      const description = (document.getElementById("description")?.value || "").trim();

      if (!title || !price || !city || !neighborhood) {
        alert("Preencha: título, preço, cidade e bairro.");
        return;
      }

      try {
        setStatus("Salvando no banco...");
        const user = auth.currentUser;
        if (!user) throw new Error("Você não está logada.");

        // garante que está ativo no /users
        await requireActiveUser(user);

        const docRef = await addDoc(collection(db, "properties"), {
          title,
          price,
          city,
          neighborhood,
          description,
          status: "draft",
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          photos: [],
          videoUrl: ""
        });

        setStatus("Salvo! Indo para fotos/vídeo...");
        location.href = `./property-media.html?id=${docRef.id}`;
      } catch (err) {
        showError("Erro ao salvar no Firestore", err);
        // dica importante: se aparecer permission-denied, é regra do Firestore.
      }
    };

    // pega SUBMIT e também CLIQUE (à prova de botão errado)
    form.addEventListener("submit", handleSave);
    if (saveBtn) saveBtn.addEventListener("click", handleSave);
  });
}

/** PASSO 2: upload de fotos/vídeo (seu html precisa ter #mediaForm, #photos, #video, #skipBtn, #propHint, #status) */
if (page === "property-media.html") {
  window.addEventListener("DOMContentLoaded", () => {
    const mediaForm = document.getElementById("mediaForm");
    if (!mediaForm) return;

    const propertyId = getIdParam();
    const hint = $("#propHint");
    const statusEl = $("#status");
    const skipBtn = $("#skipBtn");

    if (hint) hint.textContent = propertyId ? `Imóvel ID: ${propertyId}` : "Faltou ?id=";

    const goPreview = () => location.href = `./property-preview.html?id=${propertyId}`;

    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        if (!propertyId) return alert("Faltou o id do imóvel.");
        goPreview();
      });
    }

    mediaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!propertyId) return alert("Faltou o id do imóvel.");

      const photos = Array.from($("#photos")?.files || []);
      const video = ($("#video")?.files || [])[0];

      try {
        if (statusEl) statusEl.textContent = "Enviando...";

        const uploadedPhotoUrls = [];
        for (let i = 0; i < photos.length; i++) {
          const file = photos[i];
          const path = `propertyMedia/${propertyId}/photos/${Date.now()}_${i}_${file.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedPhotoUrls.push(url);
        }

        let videoUrl = "";
        if (video) {
          const path = `propertyMedia/${propertyId}/video/${Date.now()}_${video.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, video);
          videoUrl = await getDownloadURL(storageRef);
        }

        const propRef = doc(db, "properties", propertyId);
        const payload = { updatedAt: serverTimestamp() };
        if (uploadedPhotoUrls.length) payload.photos = uploadedPhotoUrls;
        if (videoUrl) payload.videoUrl = videoUrl;

        await updateDoc(propRef, payload);

        if (statusEl) statusEl.textContent = "Mídia enviada!";
        goPreview();
      } catch (err) {
        showError("Erro no upload", err);
        if (statusEl) statusEl.textContent = "";
      }
    });
  });
}

/** PASSO 3: preview + publicar (seu html precisa ter #preview, #publishBtn, #backBtn, #status) */
if (page === "property-preview.html") {
  window.addEventListener("DOMContentLoaded", async () => {
    const previewEl = $("#preview");
    if (!previewEl) return;

    const propertyId = getIdParam();
    const publishBtn = $("#publishBtn");
    const backBtn = $("#backBtn");
    const statusEl = $("#status");

    if (!propertyId) {
      previewEl.innerHTML = "<p>Faltou ?id=...</p>";
      return;
    }

    try {
      const propRef = doc(db, "properties", propertyId);
      const snap = await getDoc(propRef);

      if (!snap.exists()) {
        previewEl.innerHTML = "<p>Imóvel não encontrado.</p>";
        return;
      }

      const p = snap.data();
      const photos = Array.isArray(p.photos) ? p.photos : [];
      const videoUrl = p.videoUrl || "";

      previewEl.innerHTML = `
        <h2 style="margin-top:10px;">${p.title || ""}</h2>
        <p class="muted">R$ ${Number(p.price || 0).toLocaleString("pt-BR")}</p>
        <p>${p.city || ""} • ${p.neighborhood || ""}</p>
        <p class="muted">${p.description || ""}</p>

        ${photos.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          ${photos.map(u => `<img src="${u}" alt="foto" style="width:160px;height:110px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.08);" />`).join("")}
        </div>` : `<p class="muted">Sem fotos ainda.</p>`}

        ${videoUrl ? `<p style="margin-top:12px;"><a href="${videoUrl}" target="_blank">Ver vídeo</a></p>` : `<p class="muted">Sem vídeo.</p>`}

        <p class="muted" style="margin-top:12px;">Status atual: <b>${p.status || "draft"}</b></p>
      `;

      if (publishBtn) {
        publishBtn.addEventListener("click", async () => {
          try {
            if (statusEl) statusEl.textContent = "Publicando...";
            await updateDoc(propRef, {
              status: "active",
              publishedAt: serverTimestamp()
            });
            if (statusEl) statusEl.textContent = "Publicado!";
          } catch (err) {
            showError("Erro ao publicar", err);
            if (statusEl) statusEl.textContent = "";
          }
        });
      }

      if (backBtn) {
        backBtn.addEventListener("click", () => {
          location.href = `./property-media.html?id=${propertyId}`;
        });
      }
    } catch (err) {
      showError("Erro no preview", err);
    }
  });
}
