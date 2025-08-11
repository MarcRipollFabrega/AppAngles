/***************************************************************************/
/* CONNEXIÓN SUPABASE */
/**************************************************************************/
// La conexión a Supabase se define una sola vez al principio.
const supabaseUrl = "https://udvyzslgbaxpicfjklvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnl6c2xnYmF4cGljZmprbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTY5NTIsImV4cCI6MjA3MDIzMjk1Mn0.VjqrlFp_MfilwuTw4OSAdK3aEIwfXB2bdq6GLoJREoo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// TODO el código que interactúa con el HTML va dentro de esta función,
// definida una sola vez.
document.addEventListener("DOMContentLoaded", () => {
  /***************************************************************************/
  /* VARIABLES DE LOS FORMULARIOS */
  /**************************************************************************/
  const registroForm = document.getElementById("registro-form");
  const loginForm = document.getElementById("login-form");
  const nombreInput = document.getElementById("nombre");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  // Variables de los enlaces para cambiar de formulario
  const toggleLinks = document.querySelectorAll(".toggle-link");

  /************************************************************************** */
  /* FUNCIÓN PARA CAMBIAR ENTRE FORMULARIOS */
  /************************************************************************* */
  function cambiarFormulario() {
    if (window.getComputedStyle(loginForm).display === "none") {
      registroForm.style.display = "none";
      loginForm.style.display = "block";
    } else {
      registroForm.style.display = "block";
      loginForm.style.display = "none";
    }
  }

  /***************************************************************************/
  /* ESCUCHADORES DE EVENTOS */
  /**************************************************************************/
  // Evento para los enlaces que cambian de formulario
  toggleLinks.forEach((enlace) => {
    enlace.addEventListener("click", (e) => {
      e.preventDefault();
      cambiarFormulario();
    });
  });

  // Evento de envío del formulario de registro
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      console.error("Error al registrar usuario:", error.message);
      alert("Error al registrar usuario: " + error.message);
    } else {
      console.log("Usuario registrado con éxito:", data.user);
      alert(
        "¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta."
      );
    }
  });

  // Nota: Faltaría el código para el formulario de login.
});
