// Configuración e inicialización de Firebase para Mi-Cartera.
// El apiKey de acá NO es secreto -- está diseñado para ser público, queda
// visible en el navegador de cualquiera que use la app. La seguridad real
// viene de las reglas de Firestore (que configuramos en la consola de
// Firebase), no de esconder esto.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA3CDH7DbrpX6lUR3ovZfo_NSY6qJJkvQ4",
  authDomain: "mi-cartera-a4944.firebaseapp.com",
  projectId: "mi-cartera-a4944",
  storageBucket: "mi-cartera-a4944.firebasestorage.app",
  messagingSenderId: "866079413706",
  appId: "1:866079413706:web:2412f5a423afbaf70d6b33",
};

const app = initializeApp(firebaseConfig);

// auth: para el login de cada usuario.
// db: la base de datos (Firestore) donde van a vivir holdings y movimientos
// de cada usuario, separados por su user_id.
export const auth = getAuth(app);
export const db = getFirestore(app);
