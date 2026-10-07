import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      erro: 'Método não permitido'
    });
  }

  try {
    const {
      pedido_id,
      produto,
      quantidade,
      detalhes,
      preco
    } = req.body;

    const resultado = await sql`
      INSERT INTO pedido_itens (
        pedido_id,
        produto,
        quantidade,
        detalhes,
        preco
      )
      VALUES (
        ${pedido_id},
        ${produto},
        ${quantidade},
        ${detalhes || null},
        ${preco}
      )
      RETURNING *;
    `;

    res.status(201).json({
      sucesso: true,
      item: resultado[0]
    });

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
}
