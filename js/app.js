/***************************************************************************/
/* CONEXIÓN SUPABASE */
/***************************************************************************/
const supabaseUrl = "https://udvyzslgbaxpicfjklvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnl6c2xnYmF4cGljZmprbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTY5NTIsImV4cCI6MjA3MDIzMjk1Mn0.VjqrlFp_MfilwuTw4OSAdK3aEIwfXB2bdq6GLoJREoo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener("DOMContentLoaded", async () => {
  /***************************************************************************/
  /* VARIABLES DE LOS ELEMENTOS HTML */
  /***************************************************************************/
  const authContainer = document.getElementById("auth-container");
  const registroForm = document.getElementById("registro-form");
  const loginForm = document.getElementById("login-form");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password");

  const toggleLinks = document.querySelectorAll(".toggle-link");
  const logoutButton = document.getElementById("logout-button");
  const perfilButtons = document.getElementById("perfil-button");
  const alertDiv = document.getElementById("alerta");

  let userSession = null;

  /***************************************************************************/
  /* FUNCIÓN PARA MANEJAR LA INTERFAZ Y ALERTAS */
  /***************************************************************************/

  /** Muestra una alerta dinámica. */
  function manejarAlerta(mensaje, tipo) {
    alertDiv.className = `alerta mostrar ${tipo}`;
    alertDiv.innerHTML = `<p>${mensaje}</p>`;
    setTimeout(() => {
      alertDiv.className = "alerta";
    }, 3000);
  }

  /** Oculta todos los contenedores principales y muestra solo el especificado. */
  function mostrarContenedor(id) {
    authContainer.style.display = "none";

    // Oculta todos los botones del menú
    logoutButton.style.display = "none";

    if (id === "auth") {
      authContainer.style.display = "flex";
      // El CSS se encarga de mostrar el login por defecto.
    }
  }

  /***************************************************************************/
  /* LÓGICA DE VERIFICACIÓN DE SESIÓN */
  /***************************************************************************/

  // onAuthStateChange se encarga de todo
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    userSession = session;
    console.log("Estado de autenticación:", event, session);

    if (session) {
      // Si hay una sesión activa, ocultamos los formularios de autenticación
      authContainer.style.display = "none";
      // Y mostramos el botón de cerrar sesión
      logoutButton.style.display = "block";
      perfilButtons.style.display = "block";
    } else {
      // Si no hay sesión, mostramos los formularios de autenticación
      authContainer.style.display = "flex";
      // Y ocultamos el botón de cerrar sesión
      logoutButton.style.display = "none";
      perfilButtons.style.display = "none";
    }
  });

  /***************************************************************************/
  /* ESCUCHADORES DE EVENTOS */
  /***************************************************************************/

  // Evento de registro
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    if (email === "" || password === "") {
      manejarAlerta(
        "El email y la contraseña no pueden estar en blanco.",
        "error"
      );
      return;
    }

    const { error: signUpError } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      manejarAlerta("Error en el registro: " + signUpError.message, "error");
    } else {
      manejarAlerta(
        "¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta.",
        "exito"
      );
      registroForm.reset();
    }
  });

  // Evento de inicio de sesión
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (email === "" || password === "") {
      manejarAlerta(
        "El email o la contraseña no pueden estar en blanco.",
        "error"
      );
      return;
    }

    const { error: signInError } = await supabaseClient.auth.signInWithPassword(
      {
        email,
        password,
      }
    );

    if (signInError) {
      manejarAlerta("Error al iniciar sesión: " + signInError.message, "error");
    } else {
      // La función onAuthStateChange se encargará del cambio de pantalla
      manejarAlerta("¡Inicio de sesión exitoso!", "exito");
    }
  });

  // Evento para cerrar sesión
  logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      manejarAlerta("Error al cerrar sesión: " + error.message, "error");
    } else {
      manejarAlerta("Sesión cerrada correctamente.", "exito");
      // La función onAuthStateChange se encargará de mostrar la interfaz de auth.
      window.location.reload(); // Recargamos para limpiar la sesión
    }
  });

  // Evento para cambiar entre formularios
  toggleLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      // Oculta un formulario y muestra el otro.
      if (registroForm.style.display !== "none") {
        registroForm.style.display = "none";
        loginForm.style.display = "block";
      } else {
        registroForm.style.display = "block";
        loginForm.style.display = "none";
      }
    });
  });
});
