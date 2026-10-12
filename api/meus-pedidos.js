
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

function hashToken(token) {
    return createHash('sha256')
        .update(token)
        .digest('hex');
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');

        return res.status(405).json({
            sucesso: false,
            erro: 'Método não permitido.'
        });
    }

    try {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL não configurada.');
        }

        const token = req.headers['x-cliente-token'];

        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token)
        ) {
            return res.status(401).json({
                sucesso: false,
                erro: 'Identificação do cliente inválida.'
            });
        }

        const sql = neon(process.env.DATABASE_URL);
        const tokenHash = hashToken(token);

        const pedidos = await sql`
            SELECT
                id,
                numero_pedido,
                mesa,
                status,
                pagamento,
                observacao,
                total,
                criado_em,
                iniciado_em,
                pronto_em,
                entregue_em
            FROM pedidos
            WHERE cliente_token_hash = ${tokenHash}
            ORDER BY criado_em DESC NULLS LAST, id DESC
        `;

        return res.status(200).json({
            sucesso: true,
            pedidos
        });

    } catch (erro) {
        console.error('Erro em api/meus-pedidos.js:', erro.message);

        return res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível consultar seus pedidos.'
        });
    }
}
