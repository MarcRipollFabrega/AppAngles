/***************************************************************************/
/* CONEXIÓN SUPABASE */
/***************************************************************************/
const supabaseUrl = "https://udvyzslgbaxpicfjklvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnl6c2xnYmF4cGljZmprbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTY5NTIsImV4cCI6MjA3MDIzMjk1Mn0.VjqrlFp_MfilwuTw4OSAdK3aEIwfXB2bdq6GLoJREoo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener("DOMContentLoaded", () => {
  /***************************************************************************/
  /* VARIABLES DE LOS ELEMENTOS HTML */
  /***************************************************************************/
  const authContainer = document.getElementById("auth-container");
  const registroForm = document.getElementById("registro-form");
  const loginForm = document.getElementById("login-form");
  const bienvenidaContainer = document.getElementById("bienvenida-container");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password");

  const nombreUsuarioSpan = document.getElementById("nombre-usuario");
  const toggleLinks = document.querySelectorAll(".toggle-link");
  const logoutButton = document.getElementById("logout-button");
  const alertDiv = document.getElementById("alerta");

  /***************************************************************************/
  /* FUNCIÓN PARA MANEJAR LA INTERFAZ */
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
    bienvenidaContainer.style.display = "none";
    logoutButton.style.display = "none";

    if (id === "auth") {
      authContainer.style.display = "flex";
      registroForm.style.display = "block";
      loginForm.style.display = "none";
    } else if (id === "bienvenida") {
      bienvenidaContainer.style.display = "flex";
      logoutButton.style.display = "block";
    }
  }

  /***************************************************************************/
  /* LÓGICA PRINCIPAL DE AUTENTICACIÓN */
  /***************************************************************************/

  // Esta es la clave: se ejecuta cada vez que el estado de la sesión cambia.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Estado de autenticación:", event, session);
    if (session) {
      // Si hay una sesión activa, el usuario está logueado.
      const nombreUsuario =
        session.user.user_metadata.nombre || session.user.email;
      nombreUsuarioSpan.textContent = nombreUsuario;
      mostrarContenedor("bienvenida");
    } else {
      // Si no hay sesión, muestra los formularios de autenticación.
      mostrarContenedor("auth");
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
      // La función onAuthStateChange se encargará de mostrar la pantalla de bienvenida.
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
