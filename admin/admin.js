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

const qs = (s) => document.querySelector(s);
const page = location.pathname.split("/").pop();
/** LOGOUT */
const logoutBtn = document.querySelector("#logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      location.href = "./login.html";
    } catch (err) {
      console.error(err);
      alert("Erro ao sair.");
    }
  });
}

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
/** LOGIN */
const loginForm = qs("#loginForm");

if (page === "login.html" && loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Aceita tanto name quanto id (robusto)
    const emailEl =
      document.querySelector('input[name="email"]') ||
      document.getElementById("email");

    const passEl =
      document.querySelector('input[name="password"]') ||
      document.getElementById("password");

    if (!emailEl || !passEl) {
      alert('Campos não encontrados. Use id="email"/id="password" ou name="email"/name="password".');
      return;
    }

    const email = emailEl.value.trim();
    const password = passEl.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // 🔥 Redireciona após login
      location.href = "./dashboard.html";

    } catch (err) {
      console.error(err);
      alert("Erro no login: " + (err?.message || err));
    }
  });
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
    console.error(err);
    alert(err?.message || err);
    await signOut(auth);
    location.href = "./login.html";
  }
});
/** PASSO 1: salvar imóvel e ir para mídia (robusto: id OU name) */
const propertyForm = qs("#propertyForm");

if (page === "property-new.html" && propertyForm) {
  propertyForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // pega por name OU id (igual fizemos no login)
    const titleEl =
      document.querySelector('[name="title"]') || document.getElementById("title");
    const priceEl =
      document.querySelector('[name="price"]') || document.getElementById("price");
    const cityEl =
      document.querySelector('[name="city"]') || document.getElementById("city");
    const neighborhoodEl =
      document.querySelector('[name="neighborhood"]') || document.getElementById("neighborhood");
    const descriptionEl =
      document.querySelector('[name="description"]') || document.getElementById("description");

    if (!titleEl || !priceEl || !cityEl || !neighborhoodEl || !descriptionEl) {
      alert(
        "Não encontrei os campos do formulário. Verifique se existem IDs (title, price, city, neighborhood, description) " +
        "ou name='title' etc."
      );
      return;
    }

    const title = titleEl.value.trim();
    const priceRaw = String(priceEl.value || "").trim();
    const city = cityEl.value.trim();
    const neighborhood = neighborhoodEl.value.trim();
    const description = descriptionEl.value.trim();

    if (!title || !priceRaw || !city || !neighborhood) {
      alert("Preencha título, preço, cidade e bairro.");
      return;
    }

    // aceita 1700000, 1.700.000, 1,700,000
    const price = Number(priceRaw.replace(/\./g, "").replace(/,/g, "."));
    if (!Number.isFinite(price) || price <= 0) {
      alert("Preço inválido. Ex: 1700000");
      return;
    }

    const btn = propertyForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Você não está logada.");

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

      location.href = `./property-media.html?id=${encodeURIComponent(docRef.id)}`;
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar: " + (err?.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
/** PASSO 2: upload de fotos/vídeo */
const mediaForm = qs("#mediaForm");
if (page === "property-media.html" && mediaForm) {
  const propertyId = getIdParam();
  const hint = qs("#propHint");
  const statusEl = qs("#status");
  const skipBtn = qs("#skipBtn");

  if (hint) hint.textContent = propertyId ? `Imóvel ID: ${propertyId}` : "Faltou o parâmetro ?id=...";

  const goPreview = () => {
    location.href = `./property-preview.html?id=${propertyId}`;
  };

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      if (!propertyId) return alert("Faltou o id do imóvel.");
      goPreview();
    });
  }

  mediaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!propertyId) return alert("Faltou o id do imóvel.");

    const photos = Array.from(qs("#photos")?.files || []);
    const video = (qs("#video")?.files || [])[0];

    try {
      statusEl.textContent = "Enviando...";

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
      const payload = {};
      if (uploadedPhotoUrls.length) payload.photos = uploadedPhotoUrls;
      if (videoUrl) payload.videoUrl = videoUrl;

      if (Object.keys(payload).length) {
        payload.updatedAt = serverTimestamp();
        await updateDoc(propRef, payload);
      }

      statusEl.textContent = "Mídia enviada!";
      goPreview();
    } catch (err) {
      console.error(err);
      statusEl.textContent = "";
      alert("Erro no upload: " + (err?.message || err));
    }
  });
}

/** PASSO 3: preview + publicar */
const previewEl = qs("#preview");
if (page === "property-preview.html" && previewEl) {
  const propertyId = getIdParam();
  const publishBtn = qs("#publishBtn");
  const backBtn = qs("#backBtn");
  const statusEl = qs("#status");

  if (!propertyId) {
    previewEl.innerHTML = "<p>Faltou o parâmetro ?id=...</p>";
  } else {
    const propRef = doc(db, "properties", propertyId);
    const snap = await getDoc(propRef);

    if (!snap.exists()) {
      previewEl.innerHTML = "<p>Imóvel não encontrado.</p>";
    } else {
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

      publishBtn.addEventListener("click", async () => {
        try {
          statusEl.textContent = "Publicando...";
          await updateDoc(propRef, {
            status: "active",
            publishedAt: serverTimestamp()
          });
          statusEl.textContent = "Publicado!";
        } catch (err) {
          console.error(err);
          statusEl.textContent = "";
          alert("Erro ao publicar: " + (err?.message || err));
        }
      });

      backBtn.addEventListener("click", () => {
        location.href = `./property-media.html?id=${propertyId}`;
      });
    }
  }
}
