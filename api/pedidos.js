import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {

  try {

    // LISTAR PEDIDOS
    if (req.method === 'GET') {

      const pedidos = await sql`
        SELECT *
        FROM pedidos
        ORDER BY criado_em DESC
      `;

      return res.status(200).json({
        sucesso: true,
        pedidos
      });
    }

    // CRIAR PEDIDO
    if (req.method === 'POST') {

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

      return res.status(201).json({
        sucesso: true,
        pedido: resultado[0]
      });
    }

    return res.status(405).json({
      erro: 'Método não permitido'
    });

  } catch (erro) {

    console.error(erro);

    return res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
}
