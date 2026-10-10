
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');

        return res.status(405).json({
            sucesso: false,
            erro: 'Cadastro e alterações de funcionários estão temporariamente desativados.'
        });
    }

    try {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL não está configurada.');
        }

        const sql = neon(process.env.DATABASE_URL);

        const funcionarios = await sql`
            SELECT id, nome, ativo
            FROM funcionarios
            ORDER BY nome
        `;

        return res.status(200).json({
            sucesso: true,
            funcionarios
        });

    } catch (erro) {
        console.error('Erro em funcionarios.js:', erro.message);

        return res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível consultar os funcionários.'
        });
    }
}
