import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {

  try {

    if (req.method !== 'GET') {
      return res.status(405).json({
        erro: 'Método não permitido'
      });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        erro: 'ID do pedido não informado'
      });
    }

    const pedidos = await sql`
      SELECT *
      FROM pedidos
      WHERE id = ${id}
    `;

    if (pedidos.length === 0) {
      return res.status(404).json({
        erro: 'Pedido não encontrado'
      });
    }

    const itens = await sql`
      SELECT *
      FROM pedido_itens
      WHERE pedido_id = ${id}
      ORDER BY id
    `;

    return res.status(200).json({
      sucesso: true,
      pedido: pedidos[0],
      itens
    });

  } catch (erro) {

    console.error(erro);

    return res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
}
