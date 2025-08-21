/***************************************************************************/
/* 1. CONEXIÓ SUPABASE & INICIALITZACIÓ */
/***************************************************************************/
const supabaseUrl = "https://oysmuvizufqdwpujqnpy.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c211dml6dWZxZHdwdWpxbnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjkxNzUsImV4cCI6MjA3MTM0NTE3NX0.vNkfRJuqFH5ahPnx0sRJURokZntlCXsDIp5uwpP8Crk";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

let userSession = null;

/***************************************************************************/
/* 2. VARIABLES DE LOS ELEMENTOS HTML */
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
  // Lògica de verificació de sessió
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    userSession = session;

    if (session) {
      authContainer.style.display = "none";
      perfilContainer.style.display = "none";
      logoutButton.style.display = "block";
      perfilButton.style.display = "block";
      cargarDatosPerfil();
    } else {
      authContainer.style.display = "flex";
      perfilContainer.style.display = "none";
      logoutButton.style.display = "none";
      perfilButton.style.display = "none";
    }
  }); // Escoltador d'esdeveniments per canviar entre formularis

  toggleLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (registroForm.style.display !== "none") {
        registroForm.style.display = "none";
        loginForm.style.display = "block";
      } else {
        registroForm.style.display = "block";
        loginForm.style.display = "none";
      }
    });
  }); // Escoltador d'esdeveniments per a la previsualització de la imatge

  perfilPhotoUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        perfilPhotoPreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  }); // Escoltadors d'esdeveniments dels formularis i botons

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
      manejarAlerta("¡Inici de sessió exitós!", "exito");
    }
  });

  logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      manejarAlerta("Error en tancar sessió: " + error.message, "error");
    } else {
      manejarAlerta("Sessió tancada correctament.", "exito");
      window.location.reload();
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
});
