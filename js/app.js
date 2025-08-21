/***************************************************************************/
/* 1. CONEXIÓ SUPABASE & INICIALITZACIÓ */
/***************************************************************************/
const supabaseUrl = "https://oysmuvizufqdwpujqnpy.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c211dml6dWZxZHdwdWpxbnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjkxNzUsImV4cCI6MjA3MTM0NTE3NX0.vNkfRJuqFH5ahPnx0sRJURokZntlCXsDIp5uwpP8Crk";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

let userSession = null;

/***************************************************************************/
/* IMPORTEM L'ARXIU QUIZ. */
/***************************************************************************/
// Importem la funció 'initQuiz' del fitxer 'quiz.js'.
// Assegura't que el fitxer 'quiz.js' estigui a la mateixa carpeta.
import { initQuiz } from "./quiz.js";

/***************************************************************************/
/* 2. VARIABLES DELS ELEMENTS HTML */
/***************************************************************************/
const authContainer = document.getElementById("auth-container");
const registroForm = document.getElementById("registro-form");
const loginForm = document.getElementById("login-form");
const perfilContainer = document.getElementById("perfil-container");
const closePerfilButton = document.getElementById("close-perfil-button");
const perfilForm = document.getElementById("perfil-form");
const nombreCompletoInput = document.getElementById("nombre-completo");
const perfilPhotoUploadInput = document.getElementById("perfil-photo-upload");
const perfilPhotoPreview = document.getElementById("perfil-photo-preview");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const toggleLinks = document.querySelectorAll(".toggle-link");
const logoutButton = document.getElementById("logout-button");
const perfilButton = document.getElementById("perfil-button");
const alertDiv = document.getElementById("alerta");
const nombreUsuarioInput = document.getElementById("nombre-usuario");
const quizSection = document.getElementById("quiz-container"); // Usamos el ID correcto: quiz-container
const moduleSelection = document.getElementById("module-selection"); // Referencia a la pantalla de módulos
const exitQuizButton = document.getElementById("exit-quiz-button"); // Nuevo botón de salida

/***************************************************************************/
/* 3. FUNCIONS D'UTILITAT I DADES */
/***************************************************************************/

/** Mostra una alerta dinàmica. */
function manejarAlerta(mensaje, tipo) {
  alertDiv.className = `alerta mostrar ${tipo}`;
  alertDiv.innerHTML = `<p>${mensaje}</p>`;
  setTimeout(() => {
    alertDiv.className = "alerta";
  }, 3000);
}

/** Carrega les dades del perfil de l'usuari al formulari. */
async function cargarDatosPerfil() {
  if (!userSession) return;

  const { data: perfil, error } = await supabaseClient
    .from("perfiles")
    .select("nombre_completo, foto_url, nombre_usuario")
    .eq("id", userSession.user.id)
    .single();

  if (perfil) {
    nombreCompletoInput.value = perfil.nombre_completo || "";
    nombreUsuarioInput.value = perfil.nombre_usuario || "";
    if (perfil.foto_url) {
      perfilPhotoPreview.src = perfil.foto_url;
    } else {
      perfilPhotoPreview.src =
        "https://udvyzslgbaxpicfjklvn.supabase.co/storage/v1/object/public/perfiles/silueta.jpg";
    }
  } else {
    nombreCompletoInput.value = "";
    nombreUsuarioInput.value = "";
    perfilPhotoPreview.src = "img/silueta.jpg";
  }
  if (error && error.code !== "PGRST116") {
    console.error("Error al cargar perfil:", error);
  }
}

/***************************************************************************/
/* 4. LÒGICA DE LA INTERFÍCIE D'USUARI */
/***************************************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // Ocultem la secció principal del qüestionari per defecte.
  if (quizSection) {
    quizSection.style.display = "none";
  }

  // Assegurem que l'estat inicial dels formularis de registre i login és correcte.
  if (registroForm && loginForm) {
    registroForm.style.display = "block"; // Mostrem el formulari de registre per defecte
    loginForm.style.display = "none"; // Amaguem el formulari de login
  }

  // Lògica de verificació de sessió i inicialització de la interfície.
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    userSession = session;
    console.log("Estat d'autenticació canviat:", event, "Sessió:", session); // Ajuda per a la depuració

    if (session) {
      // Usuari autenticat
      authContainer.style.display = "none";
      perfilContainer.style.display = "none";
      logoutButton.style.display = "block";
      perfilButton.style.display = "block";

      // Mostrem el qüestionari només si l'element existeix.
      if (quizSection) {
        moduleSelection.style.display = "block";
        quizSection.style.display = "none";
      }

      cargarDatosPerfil();
      // Inicialitzem el qüestionari amb el client de Supabase
      initQuiz(supabaseClient);
    } else {
      // Usuari no autenticat
      authContainer.style.display = "flex";
      perfilContainer.style.display = "none";
      logoutButton.style.display = "none";
      perfilButton.style.display = "none";

      // Amaguem el qüestionari si l'element existeix.
      if (quizSection) {
        quizSection.style.display = "none";
      }
    }
  });

  // Escoltador d'esdeveniments per canviar entre formularis
  toggleLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      // Lògica de canvi de formulari corregida
      if (registroForm.style.display === "none") {
        registroForm.style.display = "block";
        loginForm.style.display = "none";
      } else {
        registroForm.style.display = "none";
        loginForm.style.display = "block";
      }
    });
  });

  // Escoltador d'esdeveniments per a la previsualització de la imatge
  perfilPhotoUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        perfilPhotoPreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Escoltadors d'esdeveniments dels formularis i botons
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    if (email === "" || password === "") {
      manejarAlerta(
        "El email i la contrasenya no poden estar en blanc.",
        "error"
      );
      return;
    }

    const { error: signUpError } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      manejarAlerta("Error en el registre: " + signUpError.message, "error");
    } else {
      manejarAlerta(
        "¡Registre exitós! Revisa el teu correu per confirmar el compte.",
        "exito"
      );
      registroForm.reset();
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (email === "" || password === "") {
      manejarAlerta(
        "El email o la contrasenya no poden estar en blanc.",
        "error"
      );
      return;
    }

    const { error: signInError } = await supabaseClient.auth.signInWithPassword(
      { email, password }
    );

    if (signInError) {
      manejarAlerta("Error en iniciar sessió: " + signInError.message, "error");
    } else {
      // Afegim una alerta d'èxit per a un feedback immediat
      manejarAlerta("¡Inici de sessió exitós!", "exito");
    }
  });

  logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      manejarAlerta("Error en tancar sessió: " + error.message, "error");
    } else {
      manejarAlerta("Sessió tancada correctament.", "exito");
      // La funció onAuthStateChange ja gestionarà l'estat, no cal recarregar.
    }
  });

  perfilButton.addEventListener("click", () => {
    authContainer.style.display = "none";
    perfilContainer.style.display = "flex";
    cargarDatosPerfil();
  });

  closePerfilButton.addEventListener("click", () => {
    perfilContainer.style.display = "none";
  });

  perfilForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = nombreCompletoInput.value;
    const nombreUsuario = nombreUsuarioInput.value;
    const fotoFile = perfilPhotoUploadInput.files[0];
    let fotoUrl = null;

    if (userSession) {
      if (fotoFile) {
        const fileExt = "jpg";
        const fileName = `avatar.${fileExt}`;
        const filePath = `avatares/${userSession.user.id}/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from("perfiles")
          .upload(filePath, fotoFile, { cacheControl: "60", upsert: true });

        if (uploadError) {
          manejarAlerta(
            "Error en pujar la imatge: " + uploadError.message,
            "error"
          );
          return;
        }

        const { data: publicUrlData } = supabaseClient.storage
          .from("perfiles")
          .getPublicUrl(filePath);
        fotoUrl = publicUrlData.publicUrl;
      }

      const { data: perfilExistente } = await supabaseClient
        .from("perfiles")
        .select("id")
        .eq("id", userSession.user.id);

      const updates = {
        nombre_completo: nombre,
        nombre_usuario: nombreUsuario,
        actualizado_en: new Date().toISOString(),
      };

      if (fotoUrl) {
        updates.foto_url = fotoUrl;
      }

      let error = null;
      if (perfilExistente && perfilExistente.length > 0) {
        const { error: updateError } = await supabaseClient
          .from("perfiles")
          .update(updates)
          .eq("id", userSession.user.id);
        error = updateError;
      } else {
        updates.id = userSession.user.id;
        const { error: insertError } = await supabaseClient
          .from("perfiles")
          .insert([updates]);
        error = insertError;
      }

      if (error) {
        manejarAlerta("Error al guardar el perfil: " + error.message, "error");
      } else {
        manejarAlerta("Perfil guardat amb èxit.", "exito");
        perfilContainer.style.display = "none";
      }
    }
  });

  // === AÑADIMOS LA FUNCIONALIDAD DEL BOTÓN "SALIR DEL CUESTIONARIO" ===
  // Esto asegura que la lógica se añada solo si el botón existe.
  if (exitQuizButton) {
    exitQuizButton.addEventListener("click", () => {
      // Oculta el contenedor del cuestionario
      quizSection.style.display = "none";
      // Muestra el contenedor de selección de módulos
      moduleSelection.style.display = "block";
    });
  }
});
