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
      numero_pedido,
      mesa,
      pagamento,
      observacao,
      total
    } = req.body;

    const resultado = await sql`
      INSERT INTO pedidos (
        numero_pedido,
        mesa,
        pagamento,
        observacao,
        total
      )
      VALUES (
        ${numero_pedido},
        ${mesa},
        ${pagamento},
        ${observacao || null},
        ${total}
      )
      RETURNING *;
    `;

    res.status(201).json({
      sucesso: true,
      pedido: resultado[0]
    });

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
}
