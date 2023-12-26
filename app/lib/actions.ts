'use server';
import { z } from "zod"
import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache";
import { redirect } from 'next/navigation'

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
}

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer'
    }),
    // coerce force to type number
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string()
})

const CreateInvoice = FormSchema.omit({ id: true, date: true })
const UpdateInvoice = FormSchema.omit({ id: true, date: true })

/**prevState: passed from useFormState hook */
export async function createInvoice(prevState: State, formData: FormData) {
    // safeParse: returns an object contained successfully parsed data or a ZodError without `try/catch` block
    //.safeParse(data:unknown): { success: true; data: T; } | { success: false; error: ZodError; }
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    })
    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.'
        }
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data

    const amountInCents = amount * 100;
    // FORMAT: 'YYYY-MM-DD'
    const date = new Date().toISOString().split('T')[0];
    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `
    } catch (error: any) {
        return {
            message: 'Database error: Failed to Create Invoices'
        }
    }
    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices')
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    // 
    const validatedInput = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    })

    if (!validatedInput.success) {
        return {
            errors: validatedInput.error.flatten().fieldErrors,
            message: 'Missing input value. Failed to Update Invoice'
        }
    }

    const { customerId, amount, status } = validatedInput.data

    const amountInCents = amount * 100;
    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId},
            amount=${amountInCents},
            status=${status}
        WHERE id=${id}`
    } catch (error) {
        return { message: 'Database error: Failed to Update Invoice' }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string, formData: FormData) {
    try {
        await sql`
    DELETE FROM invoices
    WHERE id=${id}`
    }
    catch (error) {
        return { message: 'Database error: Failed to Delete Invoice' }
    }
    revalidatePath('/dashboard/invoices');
}