// import { cookies } from "next/headers";
// import { jwtVerify } from "jose";
// import { redirect } from "next/navigation";

// export default async function Home() {
//   const token = cookies().get("config_token")?.value;

//   if (token) {
//     try {
//       const key = new TextEncoder().encode(process.env.CONFIG_JWT_SECRET);
//       await jwtVerify(token, key);     // token ok → manda para tenants
//       redirect("/tenants");
//     } catch {
//       // token inválido/expirado → segue para login
//     }
//   }

//   redirect("/login");
// }
