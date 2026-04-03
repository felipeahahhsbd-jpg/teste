const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '')
    })
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Liberar Authorization
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // 1. Pega o token do cabeçalho Authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { 
        statusCode: 401, 
        headers, 
        body: JSON.stringify({ error: 'Não autorizado. Token faltando.' }) 
      };
    }

    const idToken = authHeader.split('Bearer ')[1];

    // 2. Verifica o token e descobre quem é o usuário (uid)
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid; // O ID do usuário "surge" aqui com segurança

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);

    // 3. Busca Ganhos
    const depositsQuery = await db.collection('deposits')
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .where('createdAt', '>=', startTimestamp)
      .get();

    let todayEarnings = 0;
    depositsQuery.forEach(doc => todayEarnings += Number(doc.data().amount || 0));

    // 4. Busca Convidados
    const invitesQuery = await db.collection('users')
      .where('referredBy', '==', userId)
      .where('createdAt', '>=', startTimestamp)
      .get();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        todayEarnings,
        newInvites: invitesQuery.size
      })
    };

  } catch (error) {
    console.error("Erro:", error);
    return { 
      statusCode: 403, 
      headers, 
      body: JSON.stringify({ error: 'Token inválido ou expirado.' }) 
    };
  }
};
