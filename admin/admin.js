import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// COLE AQUI o firebaseConfig (vamos pegar já já)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Proteção: se não estiver logado, manda pro login
const path = location.pathname;
const isLogin = path.endsWith("/admin/login.html") || path.endsWith("/admin/") || path.endsWith("/admin");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (!isLogin) location.href = "./login.html";
    return;
  }

  // Checa se existe users/{uid} (role)
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    location.href = "./login.html";
    return;
  }
});

// Login form
const form = document.getElementById("loginForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg");
    msg.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      location.href = "./dashboard.html";
    } catch (err) {
      msg.textContent = "Falha no login. Verifique e-mail e senha.";
    }
  });
}
