import { redirect } from "next/navigation";

// La raíz no tiene contenido propio: el panel empieza en /dashboard. Si no hay
// sesión, el middleware desvía a /login desde allí, así que la comprobación de
// sesión sigue viviendo en un solo sitio.
export default function Home() {
  redirect("/dashboard");
}
