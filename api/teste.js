import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    const resultado = await sql`SELECT NOW() AS horario`;

    res.status(200).json({
      conectado: true,
      mensagem: "API conectada ao Neon!",
      horario: resultado[0].horario
    });

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      conectado: false,
      mensagem: "Erro ao conectar com o Neon.",
      erro: erro.message
    });
  }
}
