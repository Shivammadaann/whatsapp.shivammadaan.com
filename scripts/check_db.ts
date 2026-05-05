import { firebaseAdminContext, firebaseAdminDb } from "../firebaseAdmin.ts";

async function check() {
  console.log(
    firebaseAdminContext.hasExplicitCredentials
      ? `Using Firebase Admin credentials from ${firebaseAdminContext.credentialSource}${firebaseAdminContext.credentialPath ? ` (${firebaseAdminContext.credentialPath})` : ""}`
      : "Using default Firebase Admin credentials"
  );

  const db = firebaseAdminDb;
  const collections = await db.listCollections();
  console.log("Root Collections:", collections.map(c => c.id));
  
  for (const c of collections) {
    const snapshot = await c.limit(1).get();
    if (!snapshot.empty) {
      console.log(`Sample from ${c.id}:`, JSON.stringify(snapshot.docs[0].data(), null, 2));
    }
  }
}

check().catch(console.error);
