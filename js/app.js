/***************************************************************************/
/* CONNEXIÓN SUPABASE */
/**************************************************************************/
// La conexión a Supabase se define una sola vez al principio.
const supabaseUrl = "https://udvyzslgbaxpicfjklvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnl6c2xnYmF4cGljZmprbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTY5NTIsImV4cCI6MjA3MDIzMjk1Mn0.VjqrlFp_MfilwuTw4OSAdK3aEIwfXB2bdq6GLoJREoo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener("DOMContentLoaded", () => {
  /***************************************************************************/
  /* VARIABLES DE LOS FORMULARIOS */
  /**************************************************************************/
  const registroForm = document.getElementById("registro-form");
  const loginForm = document.getElementById("login-form"); // Variables para el formulario de REGISTRO
  const nombreInput = document.getElementById("nombre");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password"); // Variables para el formulario de LOGIN

  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password"); // Variables de los enlaces para cambiar de formulario

  const toggleLinks = document.querySelectorAll(".toggle-link"); // Variable de la alerta
  const alertDiv = document.getElementById("alerta"); // Captura el contenedor de bienvenida y los formularios

  const bienvenidaContainer = document.getElementById(
    "bienvenida-container"
  ); /************************************************************************** */ /* FUNCIÓN PARA CAMBIAR ENTRE FORMULARIOS */ /************************************************************************* */

  function cambiarFormulario() {
    if (window.getComputedStyle(loginForm).display === "none") {
      registroForm.style.display = "none";
      loginForm.style.display = "block";
    } else {
      registroForm.style.display = "block";
      loginForm.style.display = "none";
    }
  } /***************************************************************************/ /* ESCUCHADORES DE EVENTOS */ /**************************************************************************/ // Evento para los enlaces que cambian de formulario

  toggleLinks.forEach((enlace) => {
    enlace.addEventListener("click", (e) => {
      e.preventDefault();
      cambiarFormulario();
    });
  }); /***************************************************************************/ /* REGISTRO DE USUARIO */ /**************************************************************************/ // Evento de envío del formulario de registro
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = nombreInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    if (nombre === "" || email === "" || password === "") {
      alert("El campo no puede estar en blanco");
      return;
    } // 1. Validar si el usuario ya existe intentando iniciar sesión.

    const { error: signInError } = await supabaseClient.auth.signInWithPassword(
      {
        email,
        password,
      }
    );

    if (
      signInError &&
      signInError.message.includes("Invalid login credentials")
    ) {
      // Si el error es 'credenciales inválidas', significa que el usuario no existe.
      // Podemos proceder con el registro.

      // 2. Intentar registrar al usuario.
      const { data, error } = await supabaseClient.auth.signUp(
        {
          email: email,
          password: password,
        },
        {
          data: {
            nombre: nombre,
          },
        }
      );

      if (error) {
        // Manejar otros posibles errores de registro (contraseña corta, etc...).
        console.error("Error al registrar usuario:", error.message);
        if (error.message.includes("Password should be at least")) {
          manejarAlerta(
            "Error: La contraseña debe tener al menos 6 caracteres.",
            "error"
          );
        } else {
          manejarAlerta(
            "Ocurrió un error inesperado durante el registro: " + error.message,
            "error"
          );
        }
      } else if (data.user) {
        // Registro exitoso.
        manejarAlerta(
          "¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta.",
          "exito"
        ); // Guardar el nombre del usuario con la función updateUser

        const { data: updateData, error: updateError } =
          await supabaseClient.auth.updateUser({
            data: {
              nombre: nombre,
            },
          });

        if (updateError) {
          console.error(
            "Error al actualizar metadatos del usuario:",
            updateError
          ); // Si hay un error al actualizar, mostramos la bienvenida sin el nombre
          mostrarBienvenida("usuario");
        } else {
          // Si la actualización es exitosa, ahora sí podemos mostrar la bienvenida con el nombre
          console.log(
            "Metadatos de usuario actualizados correctamente:",
            updateData
          );
          mostrarBienvenida(nombre);
        }
      }
    } else if (signInError === null) {
      // Si no hubo error en el inicio de sesión, el usuario ya existe.
      manejarAlerta(
        "Error: El correo electrónico ya está registrado.",
        "error"
      );
    } else {
      // Manejar otros posibles errores en la validación inicial.
      manejarAlerta(
        "Ocurrió un error inesperado al verificar el usuario.",
        "error"
      );
    }
  }); /************************************************************************** */ /* FORMULARIO DE LOGIN */ /************************************************************************* */

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value; // Validación básica del formulario

    if (email === "" || password === "") {
      manejarAlerta(
        "El email o la contraseña no pueden estar en blanco.",
        "error"
      );
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Error al iniciar sesión:", error.message);
      manejarAlerta(
        "Credenciales inválidas. Por favor, revisa tu email y contraseña.",
        "error"
      );
    } else if (data.user) {
      console.log("Inicio de sesión exitoso:", data.user);
      manejarAlerta("¡Bienvenido de nuevo!", "exito");
      const nombreUsuario = data.user.user_metadata.nombre;
      mostrarBienvenida(nombreUsuario);
    }
  }); /************************************************************************** */ /* ALERTAS DINAMICAS */ /************************************************************************* */

  function manejarAlerta(mensaje, tipo) {
    // 1. Limpiar clases previas y añadir el tipo de alerta
    alertDiv.className = "alerta mostrar " + tipo; // 2. Insertar el mensaje

    alertDiv.innerHTML = mensaje; // 3. Ocultar la alerta después de 3 segundos

    setTimeout(() => {
      alertDiv.className = "alerta";
    }, 3000);
  }

  function mostrarBienvenida(nombre) {
    // 1. Oculta los formularios (registro y login)
    registroForm.style.display = "none";
    loginForm.style.display = "none"; // 2. Muestra la pantalla de bienvenida

    bienvenidaContainer.style.display = "block"; // 3. Inserta el nombre del usuario en el mensaje de bienvenida

    document.getElementById("nombre-usuario").textContent = nombre;
  }
});
