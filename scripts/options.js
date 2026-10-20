// N.B. shared.js also needs to have been loaded

console.log("Initialising options.js")

document.addEventListener('DOMContentLoaded', async () => {
    const options = await getOptions();

    for (const [key, value] of Object.entries(options)) {
        const inputElem = document.getElementById(key);

        console.log("On page load, populating option field", key, "to", value, "on element", inputElem);
        if (inputElem.type === "text") {
            inputElem.value = value;
        } else if (inputElem.type === "checkbox") {
            inputElem.checked = value;
        }
    }
});

document.addEventListener('change', async (e) => {
    console.log("Saving option relating to event", e)

    if (e.target.matches('input[type="checkbox"]')) {
        console.log("On page changed (checkbox), storing option", e.target.id, "as", e.target.checked);
        await putOption(e.target.id, e.target.checked);

    } else if (e.target.matches('input[type="text"]')) {
        console.log("On page changed (textbox), storing option", e.target.id, "as", e.target.value);
        await putOption(e.target.id, e.target.value);
    } else {
        console.log("Ignoring change event for target", e.target);
        return;
    }

    console.log("Options saved");
});

console.log("Finished initialising in options.js")
