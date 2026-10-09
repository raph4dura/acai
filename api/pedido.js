
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      sucesso: false,
      erro: 'Método não permitido.'
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está configurada.');
    }

    const sql = neon(process.env.DATABASE_URL);

    // Lê o ID tanto pela query quanto pela URL.
    const url = new URL(
      req.url,
      `https://${req.headers.host || 'localhost'}`
    );

    const idRecebido = req.query?.id ?? url.searchParams.get('id');
    const id = Number(
      Array.isArray(idRecebido) ? idRecebido[0] : idRecebido
    );

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        sucesso: false,
        erro: 'ID do pedido inválido.',
        dica: 'Informe o ID na URL, por exemplo: /api/pedido?id=1'
      });
    }

    const pedidos = await sql`
      SELECT *
      FROM pedidos
      WHERE id = ${id}
    `;

    if (pedidos.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Pedido não encontrado.'
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
    console.error('Erro em pedido.js:', erro);

    return res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível consultar o pedido.'
    });
  }
}
