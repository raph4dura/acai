
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está configurada na Vercel.');
    }

    const sql = neon(process.env.DATABASE_URL);
    const resultado = await sql`SELECT NOW() AS horario`;

    return res.status(200).json({
      conectado: true,
      mensagem: 'API conectada ao Neon!',
      horario: resultado[0].horario
    });
  } catch (erro) {
    console.error('Erro ao conectar ao Neon:', erro.message);

    return res.status(500).json({
      conectado: false,
      mensagem: 'Erro ao conectar com o Neon.',
      erro: erro.message
    });
  }
}
