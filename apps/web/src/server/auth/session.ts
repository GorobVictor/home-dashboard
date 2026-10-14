import { cookies } from "next/headers";
import { authService } from "./service";
import { readSessionToken, sessionCookieName } from "./tokens";

export async function currentUser() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) {
    return null;
  }
  const userId = await readSessionToken(token);
  return userId ? authService.findUser(userId) : null;
}
