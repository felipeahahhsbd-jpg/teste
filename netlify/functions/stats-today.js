const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Limpeza extra na privateKey para evitar erros de caractere no Netlify
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '')
    })
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  // Headers padrão para evitar erros de CORS no navegador
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Resposta para pre-flight do navegador
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ error: 'userId é obrigatório' }) 
      };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);

    // 1. Ganhos de Hoje
    const depositsQuery = await db.collection('deposits')
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .where('createdAt', '>=', startTimestamp)
      .get();

    let todayEarnings = 0;
    depositsQuery.forEach(doc => {
      todayEarnings += Number(doc.data().amount || 0);
    });

    // 2. Convidados de Hoje
    const invitesQuery = await db.collection('users')
      .where('referredBy', '==', userId)
      .where('createdAt', '>=', startTimestamp)
      .get();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        todayEarnings: todayEarnings,
        newInvites: invitesQuery.size
      })
    };

  } catch (error) {
    console.error("Erro na função stats:", error);
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
