<script lang="ts">
    import favicon from "$lib/assets/favicon.svg";

    let { children } = $props();
    import "../app.css";
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
